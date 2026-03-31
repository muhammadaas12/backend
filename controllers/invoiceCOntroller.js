const Invoice = require("../models/invoice");
const Folder = require("../models/Folder"); // Add a Folder model if you want to track folders
const cloudinary = require("cloudinary").v2;


// Upload invoice
exports.uploadInvoice = async (req, res) => {
  try {
    const { employeeId, folder, file, date, location } = req.body;

    if (!employeeId || !file || !location) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Upload image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file, {
      folder: `invoices/${folder || "default"}`,
    });

    // Save invoice in DB
    const newInvoice = new Invoice({
      employeeId,
      folder: folder || "default",
      path: uploadResult.secure_url,
      date,
      location,
    });

    await newInvoice.save();

    res.json({ success: true, invoice: newInvoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};
// Get invoices by employee, optionally by folder
exports.getInvoices = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { folder } = req.query;

    const query = { employeeId };
    if (folder) query.folder = folder;

    const invoices = await Invoice.find(query).sort({ date: -1 });
    return res.status(200).json(invoices);
  } catch (error) {
    console.log("getInvoices error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};

// Get grouped invoices for all folders
exports.getInvoicesByFolders = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const invoices = await Invoice.find({ employeeId }).sort({ date: -1 });

    const groupedInvoices = invoices.reduce((acc, invoice) => {
      const folderName = invoice.folder || "default";
      if (!acc[folderName]) acc[folderName] = [];
      acc[folderName].push(invoice);
      return acc;
    }, {});

    return res.status(200).json(groupedInvoices);
  } catch (error) {
    console.log("getInvoicesByFolders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices by folders",
      error: error.message,
    });
  }
};
// Get invoices grouped by folders filtered by location
exports.getInvoicesByFoldersForLocation = async (req, res) => {
  try {
    const { employeeId, location } = req.params; // pass location as param or query

    if (!employeeId || !location) {
      return res.status(400).json({ success: false, message: "employeeId and location required" });
    }

    // Get all invoices for the employee and location
    const invoices = await Invoice.find({ employeeId, location }).sort({ date: -1 });

    // Group by folder
    const groupedInvoices = invoices.reduce((acc, invoice) => {
      const folderName = invoice.folder || "default";
      if (!acc[folderName]) acc[folderName] = [];
      acc[folderName].push(invoice);
      return acc;
    }, {});

    return res.status(200).json(groupedInvoices);
  } catch (error) {
    console.log("getInvoicesByFoldersForLocation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices by folder for location",
      error: error.message,
    });
  }
};


exports.getFolders = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId required" });
    }

    const folders = await Folder.find({ employeeId }).sort({ name: 1 }); // sort alphabetically
    return res.status(200).json({ success: true, folders });
  } catch (error) {
    console.log("getFolders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch folders",
      error: error.message,
    });
  }
};

// Create folder
exports.createFolder = async (req, res) => {
  try {
    const { employeeId, name } = req.body;

    // Check required fields
    if (!employeeId || !name) {
      return res.status(400).json({
        success: false,
        message: "employeeId and folder name are required",
      });
    }

    // Check if folder already exists
    const existing = await Folder.findOne({ employeeId, name });
    if (existing) {
      return res.status(400).json({ success: false, message: "Folder already exists" });
    }

    const folder = await Folder.create({ employeeId, name });

    return res.status(201).json({ success: true, message: "Folder created", folder });
  } catch (error) {
    console.log("createFolder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create folder",
      error: error.message,
    });
  }
};

// Delete folder and its invoices
exports.deleteFolder = async (req, res) => {
  try {
    const { employeeId, folderName } = req.params;
    if (!folderName) {
      return res.status(400).json({ success: false, message: "Folder name required" });
    }

    // Delete all invoices in folder
    await Invoice.deleteMany({ employeeId, folder: folderName });

    // Delete folder record
    await Folder.deleteOne({ employeeId, name: folderName });

    return res.status(200).json({ success: true, message: "Folder and its invoices deleted" });
  } catch (error) {
    console.log("deleteFolder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete folder",
      error: error.message,
    });
  }
};

// Delete invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (invoice.publicId) await cloudinary.uploader.destroy(invoice.publicId);

    await Invoice.findByIdAndDelete(invoiceId);
    return res.status(200).json({ success: true, message: "Invoice deleted successfully" });
  } catch (error) {
    console.log("deleteInvoice error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete invoice",
      error: error.message,
    });
  }
};


