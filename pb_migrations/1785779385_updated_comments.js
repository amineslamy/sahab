/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // add field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_533777971",
    "help": "",
    "hidden": false,
    "id": "relation1032740943",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "parent",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // remove field
  collection.fields.removeById("relation1032740943")

  return app.save(collection)
})
