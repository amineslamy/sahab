/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2800040823",
    "help": "",
    "hidden": false,
    "id": "relation2232118775",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "topics_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3872544907",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "submitter",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation1653163849",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "relation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(15, new Field({
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

  // add field
  collection.fields.addAt(16, new Field({
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
  collection.fields.addAt(17, new Field({
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
      "اصل25",
      "محیط",
      "رسمی",
      "فنی",
      "سایبری",
      "منبع",
      "راوی"
    ]
  }))

  // add field
  collection.fields.addAt(18, new Field({
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

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "date1787879175",
    "max": "",
    "min": "",
    "name": "occurrence_date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // remove field
  collection.fields.removeById("relation2232118775")

  // remove field
  collection.fields.removeById("relation3872544907")

  // remove field
  collection.fields.removeById("relation1653163849")

  // remove field
  collection.fields.removeById("select1164694065")

  // remove field
  collection.fields.removeById("select1655102503")

  // remove field
  collection.fields.removeById("select1493410210")

  // remove field
  collection.fields.removeById("select321103221")

  // remove field
  collection.fields.removeById("date1787879175")

  return app.save(collection)
})
