/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
        "required": false,
        "system": false,
        "type": "relation"
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
        "required": true,
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
    "id": "pbc_2012230717",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_nvv35cti6s9mv` ON `report_versions` (`automation_id`)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "name": "report_versions",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2012230717");

  return app.delete(collection);
})
