// --- Imports ---

import FoodMenuModel from '../models/FoodMenuModel.js';
import PropertyModel from '../models/PropertyModel.js';

// --- Food Menu Controllers ---

/**
 * Adds a new food item to a property's menu.
 * Restricted to the host who owns the property.
 * 
 * @async
 * @function addFoodItem
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const addFoodItem = async (req, res) => {
  try {
    const {
      foodname,
      foodprice,
      servingAt,
      propertyId
    } = req.body;
    const hostId = req.user._id;

    if (!foodname || !foodprice || !servingAt || !propertyId) {
      return res.status(400).json({
        message: 'All fields are required',
        success: false
      });
    }

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({
      message: 'Property not found',
      success: false
    });
    if (property.hostBy.toString() !== hostId.toString()) {
      return res.status(403).json({
        message: 'Unauthorized',
        success: false
      });
    }

    const foodItem = await FoodMenuModel.create({
      foodname: foodname.trim(),
      foodprice: Number(foodprice),
      servingAt,
      propertyId,
    });

    return res.status(201).json({
      message: 'Food item added successfully',
      success: true,
      foodItem
    });
  } catch (error) {
    console.error('addFoodItem error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

/**
 * Updates an existing food item in a property's menu.
 * 
 * @async
 * @function updateFoodItem
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateFoodItem = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      foodname,
      foodprice,
      servingAt
    } = req.body;
    const hostId = req.user._id;

    if (!foodname || !foodprice || !servingAt) {
      return res.status(400).json({
        message: 'All fields are required',
        success: false
      });
    }

    const foodItem = await FoodMenuModel.findById(id).populate('propertyId', 'hostBy');
    if (!foodItem) return res.status(404).json({
      message: 'Food item not found',
      success: false
    });
    if (foodItem.propertyId?.hostBy?.toString() !== hostId.toString()) {
      return res.status(403).json({
        message: 'Unauthorized',
        success: false
      });
    }

    const updated = await FoodMenuModel.findByIdAndUpdate(
      id, {
        foodname: foodname.trim(),
        foodprice: Number(foodprice),
        servingAt
      }, {
        new: true,
        runValidators: true
      }
    );

    return res.status(200).json({
      message: 'Food item updated',
      success: true,
      foodItem: updated
    });
  } catch (error) {
    console.error('updateFoodItem error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

/**
 * Deletes a food item from a property's menu.
 * 
 * @async
 * @function deleteFoodItem
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const deleteFoodItem = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const hostId = req.user._id;

    const foodItem = await FoodMenuModel.findById(id).populate('propertyId', 'hostBy');
    if (!foodItem) return res.status(404).json({
      message: 'Food item not found',
      success: false
    });
    if (foodItem.propertyId?.hostBy?.toString() !== hostId.toString()) {
      return res.status(403).json({
        message: 'Unauthorized',
        success: false
      });
    }

    await FoodMenuModel.findByIdAndDelete(id);
    return res.status(200).json({
      message: 'Food item deleted',
      success: true
    });
  } catch (error) {
    console.error('deleteFoodItem error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

/**
 * Retrieves the full food menu for a specific property.
 * 
 * @async
 * @function getPropertyFoodMenu
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getPropertyFoodMenu = async (req, res) => {
  try {
    const {
      propertyId
    } = req.params;
    const menu = await FoodMenuModel.find({
      propertyId
    }).sort({
      servingAt: 1
    });
    return res.status(200).json({
      message: 'Menu fetched',
      success: true,
      menu
    });
  } catch (error) {
    console.error('getPropertyFoodMenu error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

export {
  addFoodItem,
  updateFoodItem,
  deleteFoodItem,
  getPropertyFoodMenu
};
