/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3209303753");

  return app.delete(collection);
}, (app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
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
        "id": "text1997877400",
        "max": 100,
        "min": 0,
        "name": "code",
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
        "id": "text724990059",
        "max": 255,
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
        "help": "",
        "hidden": false,
        "id": "select2599078931",
        "maxSelect": 1,
        "name": "level",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "deputy",
          "dept",
          "desk",
          "topic",
          "goal"
        ]
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text190089999",
        "max": 1000,
        "min": 0,
        "name": "path",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1169138922",
        "max": null,
        "min": null,
        "name": "sort_order",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool1260321794",
        "name": "active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_3209303753",
        "help": "",
        "hidden": false,
        "id": "relation1032740943",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "parent",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_3209303753",
    "indexes": [
      "CREATE UNIQUE INDEX idx_org_unique ON org_structure (parent, level, code)",
      "CREATE INDEX idx_org_parent_level ON org_structure (parent, level)",
      "CREATE INDEX idx_org_path ON org_structure (path)"
    ],
    "listRule": "",
    "name": "org_structure",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
})
