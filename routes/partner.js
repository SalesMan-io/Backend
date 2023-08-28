import express from "express";
import { Link } from "../models/Link.js";
import { sendEmail } from "../utils/twilio.js";
import { Partner } from "../models/Partner.js";

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { retailer, suppliers } = req.body;
    const updatedSuppliers = await Promise.all(
      suppliers.map(async (supplier) => {
        const products = await Promise.all(
          supplier.products.map(async (product) => {
            const link = await Link.create({ url: product.url });
            product.link = link._id;
            return product;
          })
        );
        return { ...supplier, products };
      })
    );
    const partner = await Partner.create({
      ...retailer,
      suppliers: updatedSuppliers,
    });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/create: ", error);
    return res.status(400).send(error);
  }
});

router.post("/addSupplier", async (req, res) => {
  try {
    const { retailerId, supplier } = req.body;
    supplier.products = await Promise.all(
      supplier.products.map(async (product) => {
        const link = await Link.create({ url: product.url });
        product.link = link._id;
        return product;
      })
    );
    await Partner.updateOne(
      {
        shopifyId: retailerId,
      },
      {
        $addToSet: {
          suppliers: supplier,
        },
      },
      { multi: false, upsert: false }
    );
    const partner = await Partner.findOne({ shopifyId: retailerId });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/addSupplier: ", error);
    return res.status(400).send(error);
  }
});

router.post("/addProducts", async (req, res) => {
  try {
    const { retailerId, supplierId, products } = req.body;
    products.forEach(async (product) => {
      const link = await Link.create({ url: product.url });
      product.link = link._id;
    });
    await Partner.updateOne(
      {
        shopifyId: retailerId,
        "suppliers.shopifyId": supplierId,
      },
      [
        {
          $set: {
            "suppliers.$.products": {
              $function: {
                lang: "js",
                args: ["$originalProducts"],
                body: function (originalProducts) {
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
                      if (!added) {
                        newProducts.push(product);
                      }
                      originalProducts = newProducts;
                    }
                  });
                  return originalProducts;
                },
              },
            },
          },
        },
      ]
    );
    const partner = await Partner.findOne({ shopifyId: retailerId });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/addSupplier: ", error);
    return res.status(400).send(error);
  }
});

router.post("/removeProducts", async (req, res) => {
  try {
    const { retailerId, supplierId, products } = req.body;
    await Partner.updateOne(
      {
        shopifyId: retailerId,
        "suppliers.shopifyId": supplierId,
      },
      [
        {
          $set: {
            "suppliers.$.products": {
              $function: {
                lang: "js",
                args: ["$originalProducts"],
                body: function (originalProducts) {
                  products.forEach((product) => {
                    originalProducts = originalProducts.filter(
                      (originalProduct) => {
                        originalProduct.shopifyId !== product.shopifyId;
                      }
                    );
                  });
                  return originalProducts;
                },
              },
            },
          },
        },
      ]
    );
    const partner = await Partner.findOne({ shopifyId: retailerId });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/addSupplier: ", error);
    return res.status(400).send(error);
  }
});

router.get("/shouldRedirect/:shopifyId", async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const partner = await Partner.findOne({ shopifyId: shopifyId });
    let shouldRedirect = false;
    for (let supplier of partner.suppliers) {
      if (supplier.noncompete) {
        shouldRedirect = true;
        break;
      }
    }
    return res.status(200).send({ shouldRedirect });
  } catch (error) {
    console.log("partner/getPartner: ", error);
    return res.status(400).send(error);
  }
});

router.get("/getPartner/:shopifyId", async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const partner = await Partner.findOne({ shopifyId: shopifyId });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/getPartner: ", error);
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
