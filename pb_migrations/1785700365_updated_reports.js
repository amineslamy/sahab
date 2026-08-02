/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // remove field
  collection.fields.removeById("date2025149370")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "date2025149370",
    "max": "",
    "min": "",
    "name": "publish_date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
})
