const zoneRectangles = [];
const zoneHideProperties = [
  '_id',
  'x1',
  'y1',
  'x2',
  'y2',
  'levelId',
  'createdAt',
  'createdBy',
];

const clearZoneRectangles = () => _.each(zoneRectangles, r => r.destroy());

//
// zonesToolboxProperties
//

Template.zonesToolboxProperties.helpers({
  properties() {
    const props = _.clone(this.zone);
    zoneHideProperties.forEach(property => { delete props[property]; });
    if (!props.roomName) props.roomName = '';
    if (!props.name) props.name = '';
    if (!props.url) props.url = '';
    if (!props.adminOnly) props.adminOnly = '';
    if (!props.teleportEndpoint) props.teleportEndpoint = '';
    if (!props.unmute) props.unmute = '';
    if (!props.unhide) props.unhide = '';
    if (!props.fullscreen) props.fullscreen = false;
    if (!props.targetedLevelId) props.targetedLevelId = '';
    if (!props.inlineURL) props.inlineURL = '';
    if (!props.hideName) props.hideName = false;
    if (!props.disableCommunications) props.disableCommunications = false;

    return JSON.stringify(props, ' ', 2);
  },
  name() { return this.zone.name || this.zone._id; },
});

Template.zonesToolboxProperties.events({
  'click .js-zone-cancel'() { Session.set('displayZoneId', undefined); },
  'click .js-zone-save'() {
    const currentFields = Zones.findOne(Session.get('displayZoneId'));
    let newValues;
    try {
      newValues = JSON.parse($('.zones-toolbox-properties textarea').val());
    } catch (err) { lp.notif.error(`invalid JSON format`, err); }

    const $unset = _.reduce(currentFields, (root, k, i) => {
      const newObject = { ...root };
      if (!zoneHideProperties.includes(i) && !Object.keys(newValues).includes(i)) newObject[i] = 1;
      return newObject;
    }, {});
    if (_.isEmpty($unset)) Zones.update(Session.get('displayZoneId'), { $set: newValues });
    else Zones.update(Session.get('displayZoneId'), { $set: newValues, $unset });
    Session.set('displayZoneId', undefined);
  },
  'click .js-zone-delete'() {
    lp.notif.confirm('Zone deletion', `Are you sure to delete the zone "<b>${this.zone.name || this.zone._id}</b>"?`, () => {
      Zones.remove(this.zone._id);
      Session.set('displayZoneId', undefined);
    });
  },
});

//
// zonesToolbox
//

Template.zonesToolbox.onCreated(() => {
  Tracker.autorun(() => {
    const zoneId = Session.get('displayZoneId');

    if (zoneId) Session.set('modal', { template: 'zonesToolboxProperties', zone: Zones.findOne(zoneId) });
    else Session.set('modal', null);
  });
});

Template.zonesToolbox.onRendered(function () {
  this.autorun(() => {
    if (!Session.get('sceneWorldReady')) return;

    clearZoneRectangles();

    const hoveredZoneId = Session.get('hoveredZoneId');

    Zones.find().forEach(zone => {
      const r = game.scene.keys.WorldScene.add.rectangle(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, hoveredZoneId === zone._id ? 0x00FF00 : 0x9966ff, 0.2);
      r.setOrigin(0, 0);
      r.setStrokeStyle(1, hoveredZoneId === zone._id ? 0x00FF00 : 0xefc53f);
      r.setDepth(20000);
      zoneRectangles.push(r);
    });
  });
});

Template.zonesToolbox.onDestroyed(() => {
  clearZoneRectangles();
  Session.set('displayZoneId', null);
});

const getZoneCenter = zone => [(zone.x1 + zone.x2) * 0.5, (zone.y1 + zone.y2) * 0.5];

Template.zonesToolbox.helpers({
  zones() { return Zones.find(); },
  zonesSortedByDistance() {
    const user = Meteor.user();
    const { x, y } = user.profile;
    const zones = Zones.find().fetch();

    // todo: sort using square edges or polygons
    const sortedZones = zones.sort((zoneA, zoneB) => {
      const zoneAPosition = getZoneCenter(zoneA);
      const zoneBPosition = getZoneCenter(zoneB);
      const zoneADistance = (zoneAPosition[0] - x) ** 2 + (zoneAPosition[1] - y) ** 2;
      const zoneBDistance = (zoneBPosition[0] - x) ** 2 + (zoneBPosition[1] - y) ** 2;

      return zoneADistance - zoneBDistance;
    });

    return sortedZones;
  },
  displayZone() { return Zones.findOne(Session.get('displayZoneId')); },
});

Template.zonesToolbox.events({
  'click .js-zone-add'() {
    const { levelId } = Meteor.user().profile;
    const zoneId = Zones.insert({ _id: Zones.id(), createdAt: new Date(), createdBy: Meteor.userId(), levelId });
    Session.set('selectedZoneId', zoneId);
    Session.set('selectedZonePoint', 1);
  },
  'click .js-properties'() {
    Session.set('displayZoneId', this._id);
  },
  'click .js-set1'() {
    Session.set('selectedZoneId', this._id);
    Session.set('selectedZonePoint', 1);
  },
  'click .js-set2'() {
    Session.set('selectedZoneId', this._id);
    Session.set('selectedZonePoint', 2);
  },
  'mousemove .zone'() {
    Session.set('hoveredZoneId', this._id);
  },
});
