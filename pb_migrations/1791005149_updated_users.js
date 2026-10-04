/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `a_users` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `a_users` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_wtf9fx9nuz` ON `a_users` (`user_code`)",
      "CREATE UNIQUE INDEX `idx_5q43zv2ms0` ON `a_users` (`username`)"
    ],
    "name": "a_users"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX `idx_wtf9fx9nuz` ON `users` (`user_code`)",
      "CREATE UNIQUE INDEX `idx_5q43zv2ms0` ON `users` (`username`)"
    ],
    "name": "users"
  }, collection)

  return app.save(collection)
})
