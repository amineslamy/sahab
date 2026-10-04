/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(6, new Field({
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
      "خیلی-محرمانه",
      "سری",
      "به-کلی-سری"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(6, new Field({
    "help": "unclassified\tعادی / عمومی confidential\tمحرمانه secret\tخیلی محرمانه top_secret\tسری strictly_classified\tبه کلی سری",
    "hidden": false,
    "id": "select1164694065",
    "maxSelect": 0,
    "name": "classification",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "unclassified",
      "confidential",
      "secret",
      "top_secret",
      "strictly_classified"
    ]
  }))

  return app.save(collection)
})
