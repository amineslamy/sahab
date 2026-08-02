/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_nvv35cti6s` ON `reports` (`automation_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
