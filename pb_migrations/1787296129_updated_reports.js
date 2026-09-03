/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // update field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "select1493410210",
    "maxSelect": 0,
    "name": "news_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "آشکار",
      "رسمی",
      "فنی",
      "سایبری",
      "منبع",
      "راوی",
      "اصل 25",
      "محیط"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // update field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "select1493410210",
    "maxSelect": 0,
    "name": "news_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "آشکار",
      "رسمی",
      "فنی",
      "سایبری",
      "منبع",
      "راوی"
    ]
  }))

  return app.save(collection)
})
