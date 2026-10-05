/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(17, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_520427368",
    "help": "",
    "hidden": false,
    "id": "relation669485965",
    "maxSelect": 100,
    "minSelect": 0,
    "name": "mentioned_people",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(18, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3927043399",
    "help": "",
    "hidden": false,
    "id": "relation2858399070",
    "maxSelect": 100,
    "minSelect": 0,
    "name": "keywords",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(17, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_520427368",
    "help": "",
    "hidden": false,
    "id": "relation669485965",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "mentioned_people",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(18, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3927043399",
    "help": "",
    "hidden": false,
    "id": "relation2858399070",
    "maxSelect": 10,
    "minSelect": 0,
    "name": "keywords",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
