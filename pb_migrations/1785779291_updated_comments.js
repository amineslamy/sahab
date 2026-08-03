/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3182418120",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "author",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // remove field
  collection.fields.removeById("relation3182418120")

  return app.save(collection)
})
