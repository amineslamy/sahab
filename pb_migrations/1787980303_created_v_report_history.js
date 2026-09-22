/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1615648943",
        "help": "",
        "hidden": false,
        "id": "_clone_VCxA",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "report_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_OTRf",
        "max": 0,
        "min": 0,
        "name": "version_title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_fHkx",
        "max": 0,
        "min": 0,
        "name": "version_abstract",
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
        "id": "_clone_vMQw",
        "maxSize": 0,
        "name": "version_content",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_hM5N",
        "maxSize": 0,
        "name": "snapshot_comments",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "_clone_n2DJ",
        "name": "version_created_at",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json3455034116",
        "maxSize": 1,
        "name": "comments_count",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ],
    "id": "pbc_1989331152",
    "indexes": [],
    "listRule": null,
    "name": "v_report_history",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT \n    rv.id AS id,\n    rv.report AS report_id,\n    rv.title AS version_title,\n    rv.abstract AS version_abstract,\n    rv.content AS version_content,\n    rv.snapshot_comments AS snapshot_comments,\n    rv.created AS version_created_at,\n    -- محاسبه تعداد کامنت‌های ثبت‌شده در این نسخه\n    JSON_ARRAY_LENGTH(rv.snapshot_comments) AS comments_count\nFROM report_versions rv\n",
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1989331152");

  return app.delete(collection);
})
