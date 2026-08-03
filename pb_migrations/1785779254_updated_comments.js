/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // add field
  collection.fields.addAt(2, new Field({
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
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // remove field
  collection.fields.removeById("relation3291445124")

  return app.save(collection)
})
