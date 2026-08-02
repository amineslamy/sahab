/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select1655102503",
    "maxSelect": 0,
    "name": "priority",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "عادی",
      "فوری",
      "آنی"
    ]
  }))

  // add field
  collection.fields.addAt(12, new Field({
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

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "select321103221",
    "maxSelect": 0,
    "name": "evaluation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "صحت دارد",
      "احتمالا صحت دارد",
      "در دست بررسی",
      "صحت ندارد"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1615648943")

  // remove field
  collection.fields.removeById("select1655102503")

  // remove field
  collection.fields.removeById("select1493410210")

  // remove field
  collection.fields.removeById("select321103221")

  return app.save(collection)
})
