/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_520427368")

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_987692768",
    "help": "",
    "hidden": false,
    "id": "relation500406608",
    "maxSelect": 90000000,
    "minSelect": 0,
    "name": "news",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_520427368")

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_987692768",
    "help": "",
    "hidden": false,
    "id": "relation500406608",
    "maxSelect": 10000000000,
    "minSelect": 0,
    "name": "news",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
