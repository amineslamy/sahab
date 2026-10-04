/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
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
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "editor3685223346",
        "maxSize": 0,
        "name": "body",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "editor3503297887",
        "maxSize": 0,
        "name": "molaheze",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "editor1797760310",
        "maxSize": 0,
        "name": "nazarie",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "editor3845127662",
        "maxSize": 0,
        "name": "orders",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
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
      },
      {
        "help": "",
        "hidden": false,
        "id": "select1602912115",
        "maxSelect": 0,
        "name": "source",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "خط",
          "محیط",
          "منبع",
          "آشکار"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "select1675611667",
        "maxSelect": 0,
        "name": "marjaa",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "مرجع انتشار1",
          "مرجع انتشار2",
          "مرجع انتشار3"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "date2277522715",
        "max": "",
        "min": "",
        "name": "occurred_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select1103511960",
        "maxSelect": 0,
        "name": "target_type",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "deputy",
          "department",
          "desk",
          "topic",
          "goal"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2123035098",
        "help": "",
        "hidden": false,
        "id": "relation569412655",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "target_deputy",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2843091914",
        "help": "",
        "hidden": false,
        "id": "relation4293998875",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "target_department",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_2110208945",
        "help": "",
        "hidden": false,
        "id": "relation3363189463",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "target_desk",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1881654863",
        "help": "",
        "hidden": false,
        "id": "relation569066775",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "target_topic",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3546325953",
        "help": "",
        "hidden": false,
        "id": "relation834993567",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "target_goal",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation669485965",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "mentioned_people",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation2858399070",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "keywords",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation3725765462",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "created_by",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_987692768",
    "indexes": [],
    "listRule": null,
    "name": "news",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768");

  return app.delete(collection);
})
