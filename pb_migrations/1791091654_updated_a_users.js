/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2123035098",
    "help": "",
    "hidden": false,
    "id": "relation3281435321",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "deputy_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2843091914",
    "help": "",
    "hidden": false,
    "id": "relation2309812382",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "department_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2110208945",
    "help": "",
    "hidden": false,
    "id": "relation332151298",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "desk_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1881654863",
    "help": "",
    "hidden": false,
    "id": "relation3340346911",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "topic_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3546325953",
    "help": "",
    "hidden": false,
    "id": "relation3305970991",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "goal_rel",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("relation3281435321")

  // remove field
  collection.fields.removeById("relation2309812382")

  // remove field
  collection.fields.removeById("relation332151298")

  // remove field
  collection.fields.removeById("relation3340346911")

  // remove field
  collection.fields.removeById("relation3305970991")

  return app.save(collection)
})
