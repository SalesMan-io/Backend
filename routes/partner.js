import express from "express";
import { Link } from "../models/Link.js";
import { sendEmail } from "../utils/twilio.js";
import { Partner } from "../models/Partner.js";

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
    const partner = await Partner.findOne({ shopifyId: retailerId });
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
    const partner = await Partner.findOne({ shopifyId: shopifyId });
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
    const partner = await Partner.findOne({ shopifyId: retailerId });
    return res.status(200).send(partner);
  } catch (error) {
    console.log("partner/removeProducts: ", error);
    return res.status(400).send(error);
  }
});

router.get("/shouldRedirect/:shopifyId", async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const partner = await Partner.findOne({ shopifyId: shopifyId });
    let supplierNoncompete = false;
    for (let supplierId of partner.supplierIds) {
      const supplier = await Partner.findOne({ shopifyId: supplierId });
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
    const partner = await Partner.findOne({ shopifyId: shopifyId });
    let suppliers = await Promise.all(
      partner.supplierIds.map(async (supplierId) => {
        const supplier = await Partner.findOne({ shopifyId: supplierId });
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
          console.log({
            ...product,
            supplier: supplier.name,
            discountCode: supplier.discountCode,
          })
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
          (item) => !galleryData.find((product) => product.shopifyId === item.shopifyId)
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
    return res.status(200).send({ ...partner._doc, suppliers, galleryData });
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
