const cloudinary = require('../utils/cloudinary');
const fs = require('fs');

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private/Admin
exports.uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please upload a file' });
  }

  try {
    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'sams-users',
      use_filename: true,
      unique_filename: true,
    });

    // Remove file from local storage after upload
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      url: result.secure_url
    });
  } catch (err) {
    console.error('Cloudinary Upload Error:', err);
    res.status(500).json({ success: false, error: 'Image upload failed' });
  }
};
