/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "updateRule": "id = @request.auth.id || @request.auth.role = \"admin_site\" || @request.auth.role = \"admin_general\" || (@request.auth.role = \"department\" && department_rel = @request.auth.id)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "updateRule": "id = @request.auth.id || @request.auth.role = \"admin_site\" || @request.auth.role = \"admin_general\""
  }, collection)

  return app.save(collection)
})
