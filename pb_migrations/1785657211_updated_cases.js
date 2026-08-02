/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3613244768")

  // add field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3613244768",
    "help": "",
    "hidden": false,
    "id": "relation1173073840",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "parent_case",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3613244768")

  // remove field
  collection.fields.removeById("relation1173073840")

  return app.save(collection)
})
