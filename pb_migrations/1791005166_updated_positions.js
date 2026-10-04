/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2998141924")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_h1nu2t4kad` ON `a_positions` (`code`)"
    ],
    "name": "a_positions"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2998141924")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_h1nu2t4kad` ON `positions` (`code`)"
    ],
    "name": "positions"
  }, collection)

  return app.save(collection)
})
