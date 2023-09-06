import express from "express";
import { Link } from "../models/Link.js";
import { sendEmail } from "../utils/twilio.js";
import { Partner } from "../models/Partner.js";
import { BSON } from "mongodb";

const router = express.Router();

const getRandom = (arr, n) => {
  var len = arr.length;
  n = Math.max(Math.min(n, len), 0);
  var result = new Array(n);
  var taken = new Array(len);
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
};

const shopOrderIdDict = {
  "www.lingskincare.com": 29383,
  "jackfir.com": 4845,
  "enerhealthbotanicals.com": 91894,
};

router.post("/create", async (req, res) => {
  try {
    const { retailer } = req.body;
    const products = await Promise.all(
      retailer.products.map(async (product) => {
        const link = await Link.create({ url: product.url });
        product.link = link._id;
        return product;
      })
    );
    const partner = await Partner.create({
      ...retailer,
      products,
    });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/create: ", error);
    return res.status(400).send(error);
  }
});

router.post("/addSupplier", async (req, res) => {
  try {
    const { retailerId, supplierId } = req.body;
    await Partner.updateOne(
      {
        shopifyId: retailerId,
      },
      {
        $addToSet: {
          supplierIds: supplierId,
        },
      },
      { multi: false, upsert: false }
    );
    const partner = await Partner.findOne(
      { shopifyId: retailerId },
      { events: 0 }
    );
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/addSupplier: ", error);
    return res.status(400).send(error);
  }
});

router.post("/addProducts", async (req, res) => {
  try {
    const { shopifyId, products } = req.body;
    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        const link = await Link.create({ url: product.url });
        product.link = link._id;
        return product;
      })
    );
    await Partner.updateOne(
      {
        shopifyId: shopifyId,
      },
      [
        {
          $set: {
            products: {
              $function: {
                lang: "js",
                args: ["$products", JSON.stringify(updatedProducts)],
                body: `function (originalProducts, products) {
                  products = JSON.parse(products);
                  products.forEach((product) => {
                    const newProducts = [];
                    let added = false;
                    for (let i = 0; i < originalProducts.length; i++) {
                      if (product.shopifyId === originalProducts[i].shopifyId) {
                        newProducts.push(product);
                        added = true;
                      } else {
                        newProducts.push(originalProducts[i]);
                      }
                    }
                    if (!added) {
                      newProducts.push(product);
                    }
                    originalProducts = newProducts;
                  });
                  return originalProducts;
                }`,
              },
            },
          },
        },
      ]
    );
    const partner = await Partner.findOne(
      { shopifyId: shopifyId },
      { events: 0 }
    );
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/addProducts: ", error);
    return res.status(400).send(error);
  }
});

router.post("/removeProducts", async (req, res) => {
  try {
    const { retailerId, products } = req.body;
    await Partner.updateOne(
      {
        shopifyId: retailerId,
      },
      [
        {
          $set: {
            products: {
              $function: {
                lang: "js",
                args: ["$products", JSON.stringify(products)],
                body: `function (originalProducts, products) {
                  products.forEach((product) => {
                    originalProducts = originalProducts.filter(
                      (originalProduct) => {
                        originalProduct.shopifyId !== product.shopifyId;
                      }
                    );
                  });
                  return originalProducts;
                }`,
              },
            },
          },
        },
      ]
    );
    const partner = await Partner.findOne(
      { shopifyId: retailerId },
      { events: 0 }
    );
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/removeProducts: ", error);
    return res.status(400).send(error);
  }
});

router.get("/shouldRedirect/:shopifyId", async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const partner = await Partner.findOne(
      { shopifyId: shopifyId },
      { events: 0 }
    );
    let supplierNoncompete = false;
    for (let supplierId of partner.supplierIds) {
      const supplier = await Partner.findOne(
        { shopifyId: supplierId },
        { events: 0 }
      );
      if (supplier.noncompete) {
        supplierNoncompete = true;
        break;
      }
    }
    return res
      .status(200)
      .send({ shouldRedirect: supplierNoncompete && partner.noncompete });
  } catch (error) {
    console.log("partner/getPartner: ", error);
    return res.status(400).send(error);
  }
});

router.get("/getPartner/:shopifyId/:orderId", async (req, res) => {
  try {
    const { shopifyId, orderId } = req.params;
    const partner = await Partner.findOne(
      { shopifyId: shopifyId },
      { events: 0 }
    );
    let suppliers = await Promise.all(
      partner.supplierIds.map(async (supplierId) => {
        const supplier = await Partner.findOne(
          { shopifyId: supplierId },
          { events: 0 }
        );
        return supplier.noncompete ? supplier : null;
      })
    );
    const totalProductCount = 12;
    suppliers = suppliers.filter((supplier) => supplier);
    const supplierProductCount = Math.floor(
      totalProductCount / suppliers.length
    );
    const galleryData = [];
    for (const supplier of suppliers) {
      let products = getRandom(supplier.products, supplierProductCount);

      products = await Promise.all(
        products.map(async (product) => {
          await Link.updateOne(
            {
              _id: product.link,
            },
            {
              $addToSet: {
                visits: `${shopifyId}/${orderId}`,
              },
            },
            { multi: false, upsert: false }
          );
          return {
            ...product._doc,
            supplier: supplier.name,
            discountCode: supplier.discountCode,
          };
        })
      );
      galleryData.push(...products);
    }
    if (galleryData.length < totalProductCount) {
      const remaining = totalProductCount - galleryData.length;
      let products = getRandom(
        suppliers[suppliers.length - 1].products.filter(
          (item) =>
            !galleryData.find((product) => product.shopifyId === item.shopifyId)
        ),
        remaining
      );
      products = await Promise.all(
        products.map(async (product) => {
          product.supplier = suppliers[suppliers.length - 1].name;
          product.discountCode = suppliers[suppliers.length - 1].discountCode;
          await Link.updateOne(
            {
              _id: product.link,
            },
            {
              $addToSet: {
                visits: `${shopifyId}/${orderId}`,
              },
            },
            { multi: false, upsert: false }
          );
          return {
            ...product._doc,
            supplier: suppliers[suppliers.length - 1].name,
            discountCode: suppliers[suppliers.length - 1].discountCode,
          };
        })
      );
      galleryData.push(...products);
    }
    galleryData.sort((a, b) => {
      return -(a.discountPercent - b.discountPercent);
    });
    await Partner.updateOne(
      {
        shopifyId: shopifyId,
      },
      {
        $addToSet: {
          events: {
            name: "Page Loaded",
            timestamp: new Date(),
            data: {
              store: shopifyId,
              orderId: orderId,
            },
          },
        },
      },
      { multi: false, upsert: false }
    );
    return res.status(200).send({ ...partner._doc, suppliers, galleryData });
  } catch (error) {
    console.log("partner/getPartner: ", error);
    return res.status(400).send(error);
  }
});

router.post("/logEvent", async (req, res) => {
  try {
    const { shopifyId, orderId, eventName } = req.body;
    if (!shopOrderIdDict[shopifyId] || shopOrderIdDict[shopifyId] > orderId) {
      return res.status(200).send("Test");
    }
    await Partner.updateOne(
      {
        shopifyId: shopifyId,
      },
      {
        $addToSet: {
          events: {
            name: eventName,
            timestamp: new Date(),
            data: {
              store: shopifyId,
              orderId: orderId,
            },
          },
        },
      },
      { multi: false, upsert: false }
    );
    return res.status(200).send();
  } catch (error) {
    console.log("partner/logEvent: ", error);
    return res.status(400).send(error);
  }
});

router.post("/addEmail", async (req, res) => {
  try {
    const { shopifyId, email } = req.body;
    await Partner.updateOne(
      {
        shopifyId: shopifyId,
      },
      {
        $addToSet: {
          emails: email,
        },
      },
      { multi: false, upsert: false }
    );
    return res.status(200).send();
  } catch (error) {
    console.log("partner/addEmail: ", error);
    return res.status(400).send(error);
  }
});

router.post("/track", async (req, res) => {
  try {
    const { shopifyId } = req.body;
    const shop = await Partner.findOne({ shopifyId: shopifyId });
    let visits = new Set();
    let uniqueClicks = new Set();
    for (const product of shop.products) {
      const link = await Link.findById(product.link);
      for (const visit of link.visits) {
        const [retailerId, orderId] = visit.split("/");
        const minimumOrderId = shopOrderIdDict[retailerId];
        if (minimumOrderId && parseInt(orderId) > minimumOrderId) {
          visits.add(visit);
        }
      }
      link.clicks.forEach((click) => {
        const [retailerId, orderId] = click.split("/");
        const minimumOrderId = shopOrderIdDict[retailerId];
        if (minimumOrderId && parseInt(orderId) > minimumOrderId) {
          console.log(click);
          uniqueClicks.add(click);
        }
      });
    }
    // for (const visit of visits) {
    //   const [retailerId, orderId] = visit.split("/");
    //   console.log(visit);
    //   const retailer = await Partner.findOne({ shopifyId: retailerId });
    //   const orderEvents = retailer.events.filter(
    //     (event) => event.data.orderId === orderId
    //   );
    //   for (let i = 0; i < orderEvents.length - 1; i++) {
    //     if (
    //       orderEvents[i].name === "Page Loaded" &&
    //       orderEvents[i + 1].name === "Page Unloaded"
    //     ) {
    //       const timeDiff =
    //         orderEvents[i + 1].timestamp - orderEvents[i].timestamp;
    //       console.log(timeDiff / 1000);
    //       break;
    //     }
    //   }
    // }
    return res
      .status(200)
      .send({ visitsCount: visits.size, unqiueClicksCount: uniqueClicks.size });
  } catch (error) {
    console.log("partner/track: ", error);
    return res.status(400).send(error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const partner = await Partner.findById(id);
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/:id: ", error);
    return res.status(400).send(error);
  }
});

export default router;
