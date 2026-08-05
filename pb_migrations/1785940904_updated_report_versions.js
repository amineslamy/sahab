/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // update field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "json1947318380",
    "maxSize": 0,
    "name": "snapshot_comments",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // update field
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

  return app.save(collection)
})
