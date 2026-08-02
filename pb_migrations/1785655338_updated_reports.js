/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "select1164694065",
    "maxSelect": 0,
    "name": "classification",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "عادی",
      "محرمانه",
      "خیلی محرمانه",
      "سری",
      "به کلی سری"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // remove field
  collection.fields.removeById("select1164694065")

  return app.save(collection)
})
