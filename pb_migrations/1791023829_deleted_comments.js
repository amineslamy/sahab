/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_533777971");

  return app.delete(collection);
}, (app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
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
        "help": "",
        "hidden": false,
        "id": "select2363381545",
        "maxSelect": 0,
        "name": "type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "ملاحظه",
          "نظریه",
          "پاسخ",
          "کامنت عمومی"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1615648943",
        "help": "",
        "hidden": false,
        "id": "relation3291445124",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "report",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation3182418120",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "author",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
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
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_533777971",
        "help": "",
        "hidden": false,
        "id": "relation1032740943",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "parent",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number3206337475",
        "max": null,
        "min": null,
        "name": "version",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
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
    "id": "pbc_533777971",
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "name": "comments",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  });

  return app.save(collection);
})
