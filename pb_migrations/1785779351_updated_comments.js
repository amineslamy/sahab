/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // add field
  collection.fields.addAt(4, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "editor999008199",
    "maxSize": 0,
    "name": "text",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971")

  // remove field
  collection.fields.removeById("editor999008199")

  return app.save(collection)
})
