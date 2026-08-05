/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "json1947318380",
    "maxSize": 0,
    "name": "snapshot_comments",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "json"
  }))

  // update field
  collection.fields.addAt(18, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1615648943",
    "help": "",
    "hidden": false,
    "id": "relation3291445124",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "report",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // remove field
  collection.fields.removeById("json1947318380")

  // update field
  collection.fields.addAt(18, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1615648943",
    "help": "",
    "hidden": false,
    "id": "relation3291445124",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "report",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
