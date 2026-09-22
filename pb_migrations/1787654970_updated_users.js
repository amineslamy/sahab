/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2998141924",
    "help": "",
    "hidden": false,
    "id": "relation843685",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "position_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2105053228",
    "help": "",
    "hidden": false,
    "id": "relation1087919055",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "role_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("relation843685")

  // remove field
  collection.fields.removeById("relation1087919055")

  return app.save(collection)
})
