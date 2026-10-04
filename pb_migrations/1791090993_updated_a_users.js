/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\""
  }, collection)

  // remove field
  collection.fields.removeById("relation2309812382")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.role = \"admin_site\" || @request.auth.role = \"admin_general\" || @request.auth.role = \"department\"",
    "deleteRule": "@request.auth.role = \"admin_site\" || @request.auth.role = \"admin_general\" || (@request.auth.role = \"department\" && department_rel = @request.auth.id)",
    "updateRule": "id = @request.auth.id || @request.auth.role = \"admin_site\" || @request.auth.role = \"admin_general\" || (@request.auth.role = \"department\" && department_rel = @request.auth.id)"
  }, collection)

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation2309812382",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "department_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
