/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `a_users` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `a_users` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_wtf9fx9nuz` ON `a_users` (`user_code`)",
      "CREATE UNIQUE INDEX `idx_5q43zv2ms0` ON `a_users` (`card_number`)"
    ],
    "passwordAuth": {
      "identityFields": [
        "card_number"
      ]
    }
  }, collection)

  // update field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4166911607",
    "max": 0,
    "min": 0,
    "name": "card_number",
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

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `a_users` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `a_users` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_wtf9fx9nuz` ON `a_users` (`user_code`)",
      "CREATE UNIQUE INDEX `idx_5q43zv2ms0` ON `a_users` (`username`)"
    ],
    "passwordAuth": {
      "identityFields": [
        "username"
      ]
    }
  }, collection)

  // update field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4166911607",
    "max": 0,
    "min": 0,
    "name": "username",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
