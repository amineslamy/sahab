/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // update collection data
  unmarshal({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": ""
  }, collection)

  // remove field
  collection.fields.removeById("text724990059")

  // remove field
  collection.fields.removeById("text1966432161")

  // remove field
  collection.fields.removeById("editor4274335913")

  // remove field
  collection.fields.removeById("text3519405507")

  // remove field
  collection.fields.removeById("file484410058")

  // remove field
  collection.fields.removeById("relation1022940913")

  // remove field
  collection.fields.removeById("file1204091606")

  // remove field
  collection.fields.removeById("relation2232118775")

  // remove field
  collection.fields.removeById("relation3872544907")

  // remove field
  collection.fields.removeById("relation3182418120")

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

  // remove field
  collection.fields.removeById("relation3441287562")

  // remove field
  collection.fields.removeById("number3206337475")

  // remove field
  collection.fields.removeById("json1947318380")

  // remove field
  collection.fields.removeById("text864642460")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "listRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text724990059",
    "max": 0,
    "min": 0,
    "name": "title",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1966432161",
    "max": 0,
    "min": 0,
    "name": "abstract",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "editor4274335913",
    "maxSize": 0,
    "name": "content",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3519405507",
    "max": 0,
    "min": 0,
    "name": "automation_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "file484410058",
    "maxSelect": 0,
    "maxSize": 20000000,
    "mimeTypes": null,
    "name": "cover_image",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3613244768",
    "help": "",
    "hidden": false,
    "id": "relation1022940913",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "cases_rel",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "file1204091606",
    "maxSelect": 16,
    "maxSize": 1200000000,
    "mimeTypes": null,
    "name": "attachments",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2800040823",
    "help": "",
    "hidden": false,
    "id": "relation2232118775",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "topics_rel",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(9, new Field({
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
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3182418120",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "author",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(11, new Field({
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
  collection.fields.addAt(12, new Field({
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

  // add field
  collection.fields.addAt(14, new Field({
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
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "date1787879175",
    "max": "",
    "min": "",
    "name": "occurrence_date",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3441287562",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "department",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "number3206337475",
    "max": null,
    "min": null,
    "name": "version",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "json1947318380",
    "maxSize": 0,
    "name": "snapshot_comments",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text864642460",
    "max": 0,
    "min": 0,
    "name": "change_reason",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
