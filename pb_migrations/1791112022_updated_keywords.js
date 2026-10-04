/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927043399")

  // remove field
  collection.fields.removeById("number253175708")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3927043399")

  // add field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "number253175708",
    "max": null,
    "min": null,
    "name": "usage_count",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
