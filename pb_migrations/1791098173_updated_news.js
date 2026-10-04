/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(8, new Field({
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
      "خبرگزاری",
      "مطبوعات",
      "صداوسیما",
      "رسانه-های-بیگانه",
      "صفحات-مجازی",
      "رسمی",
      "غیررسمی"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_987692768")

  // update field
  collection.fields.addAt(8, new Field({
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
  }))

  return app.save(collection)
})
