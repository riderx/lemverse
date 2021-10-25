import nipplejs from 'nipplejs';

const Phaser = require('phaser');

viewportModes = Object.freeze({
  fullscreen: 'fullscreen',
  small: 'small',
  splitScreen: 'split-screen',
});

const onZoneEntered = e => {
  const { zone } = e.detail;
  const { targetedLevelId, inlineURL, roomName, url, fullscreen, disableCommunications } = zone;

  if (targetedLevelId) levelManager.loadLevel(targetedLevelId);
  else if (inlineURL) characterPopIns.initFromZone(zone);

  if (roomName || url) game.scene.keys.WorldScene.updateViewport(fullscreen ? viewportModes.small : viewportModes.splitScreen);
  if (disableCommunications) {
    setTimeout(() => Meteor.users.update(Meteor.userId(), { $set: {
      'profile.shareVideo': false,
      'profile.shareAudio': false,
      'profile.shareScreen': false,
    } }), 0);
    peer.disable();
    if (userManager.player) userManager.setTintFromState(userManager.player);
  }
};

const onZoneLeaved = e => {
  const { zone } = e.detail;
  const { popInConfiguration, roomName, url, disableCommunications } = zone;
  if (!popInConfiguration?.autoOpen) characterPopIns.destroyPopIn(Meteor.userId(), zone._id);

  if (roomName || url) game.scene.keys.WorldScene.updateViewport(viewportModes.fullscreen);
  if (disableCommunications) {
    peer.enable();
    if (userManager.player) userManager.setTintFromState(userManager.player);
  }
};

WorldScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function WorldScene() {
    Phaser.Scene.call(this, { key: 'WorldScene' });
  },

  init(data) {
    this.input.keyboard.enabled = false;
    this.nippleData = undefined;
    this.nippleMoving = false;
    this.scene.sleep();
    this.viewportMode = viewportModes.fullscreen;
    entityManager.init(this);
    levelManager.init(this);
    userManager.init(this);
    userVoiceRecorderAbility.init(this);
    characterPopIns.init(this);
    this.physics.disableUpdate();

    window.addEventListener('onZoneEntered', onZoneEntered);
    window.addEventListener('onZoneLeaved', onZoneLeaved);

    this.scale.on('resize', () => this.updateViewport(this.viewportMode));

    const { levelId } = data;
    if (levelId && Meteor.user()) {
      const { spawn } = Levels.findOne({ _id: levelId });
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.levelId': levelId, 'profile.x': spawn?.x || 0, 'profile.y': spawn?.y || 0 } });
    }
  },

  create() {
    levelManager.createMap();

    // controls
    this.enableKeyboard(true, true);
    this.keys = this.input.keyboard.addKeys({
      ...this.input.keyboard.createCursorKeys(),
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    }, false, false);

    // set focus to the canvas and blur focused element on scene clicked
    this.input.on('pointerdown', () => {
      if (isModalOpen()) return;
      this.enableKeyboard(true, true);
      document.activeElement.blur();
    });

    // cameras
    this.cameras.main.setBounds(0, 0, levelManager.map.widthInPixels, levelManager.map.heightInPixels);
    this.cameras.main.roundPixels = true;

    // plugins
    userChatCircle.init(this);

    Session.set('gameCreated', true);
    Session.set('editor', 0);

    if (window.matchMedia('(pointer: coarse)').matches) {
      this.nippleManager = nipplejs.create({
        mode: 'dynamic',
        catchDistance: 150,
      });

      this.nippleManager.on('added', (evt, nipple) => {
        nipple.on('start move end dir plain', (evt2, data) => {
          if (evt2.type === 'move') {
            this.nippleMoving = true;
            this.nippleData = data;
          }
          if (evt2.type === 'end') this.nippleMoving = false;
        })
          .on('removed', () => nipple.off('start move end dir plain'));
      });
    }

    characterPopIns.onPopInEvent = e => {
      const { detail: data } = e;
      if (data.userId !== Meteor.userId()) return;

      if (data.type === 'load-level') levelManager.loadLevel(data.levelId);
    };

    // events
    this.events.on('postupdate', this.postUpdate.bind(this), this);
    this.events.once('shutdown', this.shutdown.bind(this), this);
    hotkeys.setScope('guest');
  },

  update() {
    userManager.interpolatePlayerPositions();
    userManager.handleUserInputs(this.keys, this.nippleMoving, this.nippleData);
  },

  postUpdate(time, delta) {
    userManager.postUpdate(time, delta);
    entityManager.postUpdate(time, delta);
  },

  enableKeyboard(value, globalCapture) {
    const { keyboard } = this.input;
    if (!keyboard) return;
    keyboard.enabled = value;

    if (globalCapture) keyboard.enableGlobalCapture();
    else keyboard.disableGlobalCapture();
  },

  updateViewport(mode) {
    if (mode === viewportModes.small) this.cameras.main.setViewport(0, 0, window.innerWidth / 3, window.innerHeight);
    else if (mode === viewportModes.splitScreen) this.cameras.main.setViewport(0, 0, window.innerWidth / 2, window.innerHeight);
    else this.cameras.main.setViewport(0, 0, window.innerWidth, window.innerHeight);

    this.viewportMode = mode;
  },

  shutdown() {
    this.nippleManager?.destroy();

    this.events.removeListener('postupdate');
    this.events.off('postupdate', this.postUpdate.bind(this), this);
    window.removeEventListener('onZoneEntered', onZoneEntered);
    window.removeEventListener('onZoneLeaved', onZoneLeaved);

    characterPopIns.destroy();
    levelManager.destroy();
    userChatCircle.destroy();
    userManager.destroy();
    userVoiceRecorderAbility.destroy();
    userProximitySensor.callProximityEndedForAllNearUsers();
    peer.destroy();

    Session.set('showScoreInterface', false);
  },
});
