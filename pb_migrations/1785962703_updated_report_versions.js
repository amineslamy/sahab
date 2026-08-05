/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

  // add field
  collection.fields.addAt(2, new Field({
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
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
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
  collection.fields.addAt(4, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "editor4274335913",
    "maxSize": 0,
    "name": "content",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(5, new Field({
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
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "file484410058",
    "maxSelect": 0,
    "maxSize": 0,
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
  collection.fields.addAt(7, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3613244768",
    "help": "",
    "hidden": false,
    "id": "relation1022940913",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "cases_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "file1204091606",
    "maxSelect": 17,
    "maxSize": 1300000000,
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
  collection.fields.addAt(11, new Field({
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717")

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
  collection.fields.removeById("json1947318380")

  return app.save(collection)
})
