/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "[1-9]{3}",
    "help": "",
    "hidden": false,
    "id": "text227834961",
    "max": 0,
    "min": 0,
    "name": "user_code",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "[0-9]{3}",
    "help": "",
    "hidden": false,
    "id": "text227834961",
    "max": 0,
    "min": 0,
    "name": "user_code",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
