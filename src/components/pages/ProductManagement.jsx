import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { productService } from "@/services/api/productService";
import ApperIcon from "@/components/ApperIcon";
import Loading from "@/components/ui/Loading";
import Error from "@/components/ui/Error";
import Empty from "@/components/ui/Empty";
import Checkout from "@/components/pages/Checkout";
import Category from "@/components/pages/Category";
import Cart from "@/components/pages/Cart";
import Badge from "@/components/atoms/Badge";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";

// Material UI Switch Component
const Switch = ({ checked, onChange, color = "primary", disabled = false, ...props }) => {
  const baseClasses = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const colorClasses = {
    primary: checked 
      ? "bg-primary focus:ring-primary" 
      : "bg-gray-200 focus:ring-gray-300",
    secondary: checked 
      ? "bg-secondary focus:ring-secondary" 
      : "bg-gray-200 focus:ring-gray-300"
  };
  
  return (
    <button
      type="button"
      className={`${baseClasses} ${colorClasses[color]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      {...props}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

const ProductManagement = () => {
  // State management with proper initialization
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [pendingVisibilityToggles, setPendingVisibilityToggles] = useState(new Set());
// Enhanced monitoring and alert system
  const [monitoringData, setMonitoringData] = useState({
    submissionAttempts: 0,
    failedSubmissions: 0,
    lastFailureTime: null,
    hourlyFailures: [],
    alertsSent: 0
  });

  const [emergencyMode, setEmergencyMode] = useState(false);
  
  // Load monitoring data from localStorage
  useEffect(() => {
    const savedMonitoring = localStorage.getItem('productSubmissionMonitoring');
    if (savedMonitoring) {
      try {
        const parsed = JSON.parse(savedMonitoring);
        setMonitoringData(parsed);
      } catch (error) {
        console.error('Failed to load monitoring data:', error);
      }
    }
  }, []);

  // Save monitoring data to localStorage
  const saveMonitoringData = (data) => {
    try {
      localStorage.setItem('productSubmissionMonitoring', JSON.stringify(data));
      setMonitoringData(data);
    } catch (error) {
      console.error('Failed to save monitoring data:', error);
    }
  };

  // Log submission attempt
  const logSubmissionAttempt = (success, errorDetails = null) => {
    const now = Date.now();
    const currentHour = Math.floor(now / (1000 * 60 * 60));
    
    setMonitoringData(prev => {
      const newData = {
        ...prev,
        submissionAttempts: prev.submissionAttempts + 1,
        failedSubmissions: success ? prev.failedSubmissions : prev.failedSubmissions + 1,
        lastFailureTime: success ? prev.lastFailureTime : now
      };

      // Track hourly failures
      if (!success) {
        const hourlyFailures = [...prev.hourlyFailures];
        const existingHour = hourlyFailures.find(h => h.hour === currentHour);
        
        if (existingHour) {
          existingHour.count += 1;
          existingHour.errors.push({
            timestamp: now,
            error: errorDetails || 'Unknown error',
            userAgent: navigator.userAgent
          });
        } else {
          hourlyFailures.push({
            hour: currentHour,
            count: 1,
            errors: [{
              timestamp: now,
              error: errorDetails || 'Unknown error',
              userAgent: navigator.userAgent
            }]
          });
        }

        // Keep only last 24 hours
        newData.hourlyFailures = hourlyFailures.filter(h => h.hour > currentHour - 24);
      }

      // Check if alert should be sent
      const currentHourFailures = newData.hourlyFailures.find(h => h.hour === currentHour);
      if (currentHourFailures && currentHourFailures.count >= 5 && !success) {
        sendAdminAlert(currentHourFailures);
      }

      saveMonitoringData(newData);
      return newData;
    });
  };

  // Send admin alert
  const sendAdminAlert = async (hourlyData) => {
    if (monitoringData.alertsSent >= 3) {
      console.log('Alert limit reached for current session');
      return;
    }

    try {
      const alertData = {
        type: 'PRODUCT_SUBMISSION_FAILURE',
        severity: 'HIGH',
        message: `High failure rate detected: ${hourlyData.count} failed product submissions in the last hour`,
        details: {
          failureCount: hourlyData.count,
          timeFrame: 'Last Hour',
          errors: hourlyData.errors.slice(-3), // Last 3 errors
          totalAttempts: monitoringData.submissionAttempts,
          totalFailures: monitoringData.failedSubmissions,
          failureRate: ((monitoringData.failedSubmissions / monitoringData.submissionAttempts) * 100).toFixed(2) + '%'
        },
        timestamp: new Date().toISOString(),
        actionRequired: true,
        recommendations: [
          'Check server connectivity and image processing services',
          'Review recent product submissions for patterns',
          'Consider enabling emergency mode for critical operations',
          'Monitor system resources and error logs'
        ]
      };

      // In a real implementation, this would send to your notification service
      console.warn('ADMIN ALERT:', alertData);
      
      // Simulate notification service call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      toast.error(`Admin Alert: High failure rate detected (${hourlyData.count} failures/hour)`, {
        autoClose: 8000,
        className: 'bg-red-600 text-white'
      });

      setMonitoringData(prev => ({
        ...prev,
        alertsSent: prev.alertsSent + 1
      }));

    } catch (error) {
      console.error('Failed to send admin alert:', error);
    }
  };
  // Preview Mode State
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop, mobile
  const [previewProducts, setPreviewProducts] = useState([]);
  const [previewCart, setPreviewCart] = useState([]);
  const [selectedPreviewProduct, setSelectedPreviewProduct] = useState(null);
const [formData, setFormData] = useState({
    name: "",
    price: "",
    previousPrice: "",
    purchasePrice: "",
    discountType: "Fixed Amount",
    discountValue: "",
    minSellingPrice: "",
    profitMargin: "",
    category: "",
    stock: "",
    minStock: "",
    unit: "",
    description: "",
    imageUrl: "",
    barcode: "",
    isVisible: true,
    enableVariations: false,
    variations: [],
    discountStartDate: "",
    discountEndDate: "",
    discountPriority: 1
  });
  
  // Image management state
const [imageData, setImageData] = useState({
    selectedImage: null,
    croppedImage: null,
    isProcessing: false
  });

  // Constants
  const categories = ["Groceries", "Meat", "Fruits", "Vegetables", "Dairy", "Bakery", "Beverages"];
  const units = ["kg", "g", "piece", "litre", "ml", "pack", "dozen", "box"];

  // Load products with comprehensive error handling
// Load products with comprehensive error handling
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productService.getAll();
      const productsArray = Array.isArray(data) ? data : [];
      setProducts(productsArray);
      
// Update preview products with customer-visible products only
      const visibleProducts = productsArray.filter(p => p.isVisible !== false);
      setPreviewProducts(visibleProducts);
      
    } catch (err) {
      console.error("Error loading products:", err);
      setError(err.message || "Failed to load products");
      toast.error("Failed to load products. Please try again.");
      setProducts([]);
      setPreviewProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    loadProducts();
  }, []);

  // Handle form input changes with validation and profit calculations
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      
      // Auto-calculate profit metrics when relevant fields change
      if (name === 'price' || name === 'purchasePrice' || name === 'discountType' || name === 'discountValue') {
        const calculations = calculateProfitMetrics(newData);
        return {
          ...newData,
          ...calculations
        };
      }
      
      return newData;
    });
  };

  // Handle image upload and processing
const handleImageUpload = async (file) => {
    const startTime = performance.now();
    
    try {
      setImageData(prev => ({ ...prev, isProcessing: true }));
      
      // Enhanced validation for 10MB+ files
      const validation = await productService.validateImage(file);
      if (!validation.isValid) {
        logSubmissionAttempt(false, `Image validation failed: ${validation.error}`);
        toast.error(validation.error);
        setImageData(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      // Process image with performance monitoring
      let processedImage;
      try {
        processedImage = await productService.processImage(file, {
          targetSize: { width: 600, height: 600 },
          maxFileSize: 10 * 1024 * 1024, // 10MB limit
          quality: 0.9,
          enforceSquare: true
        });
      } catch (processingError) {
        console.error('Image processing failed:', processingError);
        logSubmissionAttempt(false, `Image processing failed: ${processingError.message}`);
        
        // Fallback: use original file if processing fails
        const imageUrl = URL.createObjectURL(file);
        setImageData(prev => ({
          ...prev,
          selectedImage: imageUrl,
          croppedImage: imageUrl,
          isProcessing: false
        }));
        setFormData(prev => ({ ...prev, imageUrl }));
        toast.warning('Image uploaded without optimization. Quality may be reduced.');
        return;
      }
      
      // Check processing time
      const processingTime = performance.now() - startTime;
      if (processingTime > 2000) { // 2 second threshold
        console.warn(`Image processing took ${processingTime.toFixed(0)}ms (>2s threshold)`);
      }

      setImageData(prev => ({
        ...prev,
        selectedImage: processedImage.url,
        croppedImage: processedImage.url,
        isProcessing: false,
        processingMetrics: {
          originalSize: file.size,
          processedSize: processedImage.size,
          processingTime,
          compressionRatio: ((file.size - processedImage.size) / file.size * 100).toFixed(1)
        }
      }));
      
      setFormData(prev => ({ ...prev, imageUrl: processedImage.url }));
      
      const compressionInfo = processedImage.size < file.size 
        ? ` (${((file.size - processedImage.size) / file.size * 100).toFixed(1)}% smaller)`
        : '';
      
      toast.success(`✓ Image processed successfully in ${processingTime.toFixed(0)}ms${compressionInfo}`);
      logSubmissionAttempt(true);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      logSubmissionAttempt(false, error.message);
      setImageData(prev => ({ ...prev, isProcessing: false }));
      
      // Enhanced error messaging
      if (error.message.includes('network')) {
        toast.error('Network error during image upload. Please check your connection and try again.');
      } else if (error.message.includes('timeout')) {
        toast.error('Image upload timed out. Try a smaller image or check your connection.');
      } else {
        toast.error(`Failed to upload image: ${error.message}`);
      }
    }
};

  // Handle image search - moved before usage to fix hoisting issue
  const handleImageSearch = async (searchQuery) => {
    try {
      setImageData(prev => ({ ...prev, isProcessing: true }));
      
      // Mock image search results - replace with actual API call
      const mockResults = [
        `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop`,
        `https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=600&fit=crop`,
        `https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=600&fit=crop`
      ];
      
      setImageData(prev => ({
        ...prev,
        searchResults: mockResults,
        isProcessing: false
      }));
      
      toast.success(`Found ${mockResults.length} images for "${searchQuery}"`);
    } catch (error) {
      console.error('Error searching images:', error);
      setImageData(prev => ({ ...prev, isProcessing: false }));
      toast.error('Failed to search images. Please try again.');
    }
  };

  // Handle AI image generation - moved before usage to fix hoisting issue
  const handleAIImageGenerate = async (prompt) => {
    try {
      setImageData(prev => ({ ...prev, isProcessing: true }));
      
      // Mock AI generation - replace with actual API call
      const generatedImage = `https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&h=600&fit=crop`;
      
      setImageData(prev => ({
        ...prev,
        selectedImage: generatedImage,
        croppedImage: generatedImage,
        isProcessing: false
      }));
      
      setFormData(prev => ({ ...prev, imageUrl: generatedImage }));
      toast.success('✓ AI image generated successfully!');
    } catch (error) {
      console.error('Error generating AI image:', error);
      setImageData(prev => ({ ...prev, isProcessing: false }));
      toast.error('Failed to generate AI image. Please try again.');
    }
  };

  // Handle image selection from search results
  const handleImageSelect = (imageUrl) => {
    setImageData(prev => ({
      ...prev,
      selectedImage: imageUrl,
      croppedImage: imageUrl
    }));
    setFormData(prev => ({ ...prev, imageUrl }));
    toast.success('✓ Image selected!');
  };
  const calculateProfitMetrics = (data) => {
    const price = parseFloat(data.price) || 0;
    const purchasePrice = parseFloat(data.purchasePrice) || 0;
    const discountValue = parseFloat(data.discountValue) || 0;
    
    let finalPrice = price;
    
    // Apply discount based on type
    if (discountValue > 0) {
      if (data.discountType === 'Percentage') {
        finalPrice = price - (price * discountValue / 100);
      } else {
        finalPrice = price - discountValue;
      }
    }
    
    // Ensure final price is not negative
    finalPrice = Math.max(0, finalPrice);
    
    // Calculate minimum selling price (purchase price + 10% margin)
    const minSellingPrice = purchasePrice > 0 ? purchasePrice * 1.1 : 0;
    
    // Calculate profit margin percentage
    let profitMargin = 0;
    if (purchasePrice > 0 && finalPrice > 0) {
      profitMargin = ((finalPrice - purchasePrice) / purchasePrice) * 100;
    }
    
    return {
      minSellingPrice: minSellingPrice.toFixed(2),
      profitMargin: profitMargin.toFixed(2)
    };
  };

  // Form submission with comprehensive validation
// Form submission with comprehensive validation including offer conflicts and price guards
const handleSubmit = async (e) => {
    e.preventDefault();
    const submissionStartTime = performance.now();
    
    try {
      // Enhanced validation with monitoring
      const validationErrors = [];
      
      if (!formData.name?.trim()) {
        validationErrors.push("Product name is required");
      }
      
      if (!formData.price || parseFloat(formData.price) <= 0) {
        validationErrors.push("Valid price is required");
      }
      
      if (!formData.category) {
        validationErrors.push("Category is required");
      }
      
      if (!formData.stock || parseInt(formData.stock) < 0) {
        validationErrors.push("Valid stock quantity is required");
      }

      // Image validation (unless in emergency mode)
      if (!emergencyMode && !formData.imageUrl) {
        validationErrors.push("Product image is required (or use Emergency Mode)");
      }

      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.join(", ");
        logSubmissionAttempt(false, `Validation failed: ${errorMessage}`);
toast.error(errorMessage);
        return;
      }
      // Enhanced business rules validation with price guards
      const purchasePrice = parseFloat(formData.purchasePrice) || 0;
      const price = parseFloat(formData.price) || 0;
      const discountValue = parseFloat(formData.discountValue) || 0;
      
      // Price guard validation
      if (purchasePrice > 0 && price <= purchasePrice) {
        toast.error("Selling price must be greater than purchase price");
        return;
      }

      // Min/max price guards
      if (price < 1) {
        toast.error("Price cannot be less than Rs. 1");
        return;
      }

      if (price > 100000) {
        toast.error("Price cannot exceed Rs. 100,000");
        return;
      }

      // Discount validation with guards
      if (discountValue > 0) {
        if (formData.discountType === 'Percentage' && discountValue > 90) {
          toast.error("Percentage discount cannot exceed 90%");
          return;
        }
        
        if (formData.discountType === 'Fixed Amount' && discountValue >= price) {
          toast.error("Fixed discount cannot be equal to or greater than the product price");
          return;
        }

        // Calculate final price after discount
        let finalPrice = price;
        if (formData.discountType === 'Percentage') {
          finalPrice = price - (price * discountValue / 100);
        } else {
          finalPrice = price - discountValue;
        }

        // Ensure final price doesn't go below purchase price
        if (purchasePrice > 0 && finalPrice <= purchasePrice) {
          toast.error("Discounted price cannot be equal to or less than purchase price");
          return;
        }
      }

      // Prepare product data with proper validation
      const productData = {
        ...formData,
price: parseFloat(formData.price) || 0,
        previousPrice: formData.previousPrice ? parseFloat(formData.previousPrice) : null,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        discountValue: parseFloat(formData.discountValue) || 0,
        minSellingPrice: parseFloat(formData.minSellingPrice) || 0,
        profitMargin: parseFloat(formData.profitMargin) || 0,
        stock: parseInt(formData.stock) || 0,
        minStock: formData.minStock ? parseInt(formData.minStock) : 5,
        imageUrl: emergencyMode ? "/api/placeholder/300/200" : (formData.imageUrl || "/api/placeholder/300/200"),
        barcode: formData.barcode || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        // Add monitoring metadata
        submissionMetadata: {
          emergencyMode,
          processingTime: imageData.processingMetrics?.processingTime || 0,
          submissionTime: submissionStartTime,
          userAgent: navigator.userAgent.substring(0, 100)
        }
      };

// Validate offer conflicts before saving
      const conflictValidation = await productService.validatePricingHierarchy(
        productData, 
        products, 
        editingProduct?.id
      );
      
      if (!conflictValidation.isValid) {
        toast.error(`Offer Conflict: ${conflictValidation.error}`);
        
        // Show detailed conflict information
        if (conflictValidation.conflicts && conflictValidation.conflicts.length > 0) {
          const conflictDetails = conflictValidation.conflicts.map(c => 
            `${c.type}: ${c.details}`
          ).join('\n');
          toast.warning(`Conflicts detected:\n${conflictDetails}`, { autoClose: 8000 });
        }
        
        return;
}

      // Performance monitoring
      const submissionTime = performance.now() - submissionStartTime;
      if (submissionTime > 2000) {
        console.warn(`Product submission took ${submissionTime.toFixed(0)}ms (>2s threshold)`);
      }

      let result;
      if (editingProduct) {
        result = await productService.update(editingProduct.id, productData);
        toast.success("Product updated successfully!");
      } else {
        result = await productService.create(productData);
const successMessage = emergencyMode 
          ? "Product created successfully (Emergency Mode - no image)" 
          : "Product created successfully!";
        toast.success(successMessage);
        logSubmissionAttempt(true);
      }

      // Reset form and reload products
      resetForm();
      setEmergencyMode(false);
      await loadProducts();
      
      // Update preview if enabled
      if (previewMode) {
        const visibleProducts = products.filter(p => p.isVisible !== false);
        setPreviewProducts(visibleProducts);
      }
      
} catch (err) {
console.error("Error saving product:", err);
      logSubmissionAttempt(false, err.message);
      toast.error(err.message || "Failed to save product");
    }
  };

  // Handle product editing
const handleEdit = (product) => {
    if (!product) return;
    setEditingProduct(product);
    setEmergencyMode(false); // Reset emergency mode when editing
    setFormData({
      name: product.name || "",
      price: product.price?.toString() || "",
      previousPrice: product.previousPrice?.toString() || "",
      purchasePrice: product.purchasePrice?.toString() || "",
      discountType: product.discountType || "Fixed Amount",
      discountValue: product.discountValue?.toString() || "",
      minSellingPrice: product.minSellingPrice?.toString() || "",
      profitMargin: product.profitMargin?.toString() || "",
      category: product.category || "",
      stock: product.stock?.toString() || "",
      minStock: product.minStock?.toString() || "",
      unit: product.unit || "",
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      barcode: product.barcode || "",
      isVisible: product.isVisible !== false,
      enableVariations: product.enableVariations || false,
      variations: product.variations || [],
      discountStartDate: product.discountStartDate || "",
      discountEndDate: product.discountEndDate || "",
      discountPriority: product.discountPriority || 1
    });
    setShowAddForm(true);
  };

  // Handle product deletion with confirmation
  const handleDelete = async (id) => {
    if (!id) return;
    
    try {
      const confirmed = window.confirm("Are you sure you want to delete this product?");
      if (!confirmed) return;

      await productService.delete(id);
      toast.success("Product deleted successfully!");
      await loadProducts();
    } catch (err) {
      console.error("Error deleting product:", err);
      toast.error(err.message || "Failed to delete product");
}
  };

  // Handle product visibility toggle
  const handleVisibilityToggle = async (productId, currentVisibility) => {
    if (pendingVisibilityToggles.has(productId)) {
      return; // Prevent double-clicks
    }

    try {
      // Add to pending set for UI feedback
      setPendingVisibilityToggles(prev => new Set(prev).add(productId));
      
      // Optimistically update the local state
      const newVisibility = !currentVisibility;
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { ...product, isVisible: newVisibility }
            : product
        )
      );

      // Sync with backend
      await productService.update(productId, { isVisible: newVisibility });
      
      toast.success(
        newVisibility 
          ? "Product is now visible to customers" 
          : "Product is now hidden from customers"
      );
      
    } catch (error) {
      console.error("Error updating product visibility:", error);
      
      // Revert optimistic update on error
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { ...product, isVisible: currentVisibility }
            : product
        )
      );
      
      toast.error("Failed to update product visibility. Please try again.");
    } finally {
      // Remove from pending set
      setPendingVisibilityToggles(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
}
    
    // Update preview products when visibility changes
    if (previewMode) {
      setTimeout(() => {
        const visibleProducts = products.filter(p => p.isVisible !== false);
        setPreviewProducts(visibleProducts);
      }, 100);
    }
  };

  // Reset form state
const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      previousPrice: "",
      purchasePrice: "",
      discountType: "Fixed Amount",
      discountValue: "",
      minSellingPrice: "",
      profitMargin: "",
      category: "",
      stock: "",
      minStock: "",
      unit: "",
      description: "",
      imageUrl: "",
      barcode: "",
      isVisible: true,
      enableVariations: false,
      variations: [],
      discountStartDate: "",
      discountEndDate: "",
      discountPriority: 1
    });
    
    // Reset image data
    setImageData({
      selectedImage: null,
      croppedImage: null,
      isProcessing: false,
      processingMetrics: null
    });
    
    setEditingProduct(null);
    setShowAddForm(false);
    setEmergencyMode(false);
  };

  // Emergency mode toggle
  const toggleEmergencyMode = () => {
    setEmergencyMode(prev => {
      const newMode = !prev;
      if (newMode) {
        toast.warning('Emergency Mode Enabled: Products can be created without images', {
          autoClose: 5000
        });
      } else {
        toast.info('Emergency Mode Disabled: Image upload required');
      }
      return newMode;
    });
  };

  // Handle bulk price update
  const handleBulkPriceUpdate = async (updateData) => {
    try {
      if (!updateData) {
        toast.error("Invalid update data");
        return;
      }

      await productService.bulkUpdatePrices(updateData);
      toast.success("Bulk price update completed successfully!");
      setShowBulkPriceModal(false);
      await loadProducts();
    } catch (err) {
      console.error("Error updating prices:", err);
      toast.error(err.message || "Failed to update prices");
    }
  };

  // Filter products with null safety
  const filteredProducts = products.filter(product => {
    if (!product) return false;
    
    const matchesSearch = !searchTerm || 
      (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.includes(searchTerm));
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
return matchesSearch && matchesCategory;
  });

  // Error boundary component
  if (error) {
    return <Error message={error} onRetry={loadProducts} />;
  }

  // Loading state
  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-full mx-auto">
      {previewMode ? (
        <PreviewMode
          products={products}
          previewProducts={previewProducts}
          previewDevice={previewDevice}
          setPreviewDevice={setPreviewDevice}
          previewCart={previewCart}
          setPreviewCart={setPreviewCart}
          selectedPreviewProduct={selectedPreviewProduct}
          setSelectedPreviewProduct={setSelectedPreviewProduct}
          onExitPreview={() => setPreviewMode(false)}
          // Admin panel props
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          editingProduct={editingProduct}
          setEditingProduct={setEditingProduct}
          showBulkPriceModal={showBulkPriceModal}
          setShowBulkPriceModal={setShowBulkPriceModal}
          pendingVisibilityToggles={pendingVisibilityToggles}
          formData={formData}
          setFormData={setFormData}
          imageData={imageData}
          setImageData={setImageData}
          categories={categories}
          units={units}
          filteredProducts={filteredProducts}
          handleInputChange={handleInputChange}
          handleImageUpload={handleImageUpload}
handleImageSearch={handleImageSearch}
          handleImageSelect={handleImageSelect}
          handleSubmit={handleSubmit}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleVisibilityToggle={handleVisibilityToggle}
          resetForm={resetForm}
          handleBulkPriceUpdate={handleBulkPriceUpdate}
        />
      ) : (
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Management</h1>
              <p className="text-gray-600">Manage your product inventory and pricing</p>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
              <Button
                variant="outline"
                icon="Monitor"
                onClick={() => setPreviewMode(true)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                Customer Preview
              </Button>
              <Button
                variant="secondary"
                icon="DollarSign"
                onClick={() => setShowBulkPriceModal(true)}
                disabled={!products.length}
              >
                Bulk Price Update
              </Button>
              <Button
                variant="primary"
                icon="Plus"
                onClick={() => setShowAddForm(true)}
              >
                Add Product
              </Button>
            </div>
          </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Search Products"
            placeholder="Search by name or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Products ({filteredProducts.length})
            </h2>
            <div className="flex items-center space-x-2">
              <Badge variant="primary">
                Total: {products.length}
              </Badge>
              <Badge variant="secondary">
                Low Stock: {products.filter(p => p && p.stock <= (p.minStock || 5)).length}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredProducts.length === 0 ? (
            <Empty 
              title="No products found"
              description="Try adjusting your search or filter criteria"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price / Purchase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit Margin
                    </th>
<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visibility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
{filteredProducts.map((product) => (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 transition-opacity duration-200 ${
                        product.isVisible === false ? 'opacity-60' : 'opacity-100'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={product.imageUrl || "/api/placeholder/40/40"}
                              alt={product.name || "Product"}
                              onError={(e) => {
                                e.target.src = "/api/placeholder/40/40";
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {product.name || "Unnamed Product"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {product.barcode || "No barcode"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="secondary">
                          {product.category || "No Category"}
                        </Badge>
                      </td>
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">Rs. {product.price || 0}</span>
                          {product.purchasePrice && (
                            <span className="text-xs text-gray-500">
                              Cost: Rs. {product.purchasePrice}
                            </span>
                          )}
                          {product.previousPrice && (
                            <span className="text-xs text-gray-400 line-through">
                              Was: Rs. {product.previousPrice}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {product.profitMargin ? (
                          <div className="flex flex-col">
                            <Badge 
                              variant={parseFloat(product.profitMargin) > 20 ? "success" : parseFloat(product.profitMargin) > 10 ? "warning" : "error"}
                            >
                              {product.profitMargin}%
                            </Badge>
                            {product.minSellingPrice && (
                              <span className="text-xs text-gray-500 mt-1">
                                Min: Rs. {product.minSellingPrice}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <Badge 
                          variant={product.stock <= (product.minStock || 5) ? "error" : "success"}
                        >
                          {product.stock || 0} {product.unit || "pcs"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={product.isVisible !== false}
                              onChange={() => handleVisibilityToggle(product.id, product.isVisible !== false)}
                              color="primary"
                              disabled={pendingVisibilityToggles.has(product.id)}
                            />
                            <span className={`text-sm font-medium ${
                              product.isVisible === false ? 'text-gray-400' : 'text-gray-700'
                            }`}>
                              {product.isVisible === false ? 'Hidden' : 'Visible'}
                            </span>
                            {pendingVisibilityToggles.has(product.id) && (
                              <div className="ml-2">
                                <ApperIcon name="Loader2" size={14} className="animate-spin text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="Edit"
                            onClick={() => handleEdit(product)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="Trash2"
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
<div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h2>
                  {emergencyMode && (
                    <Badge variant="warning" className="text-xs font-bold animate-pulse">
                      EMERGENCY MODE
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {/* Emergency Mode Toggle */}
                  <Button
                    type="button"
                    variant={emergencyMode ? "warning" : "ghost"}
                    size="sm"
                    icon={emergencyMode ? "AlertTriangle" : "Shield"}
                    onClick={toggleEmergencyMode}
                    className={`${emergencyMode ? 'bg-red-100 text-red-700 border-red-200' : 'text-gray-500'} transition-all duration-200`}
                  >
                    {emergencyMode ? "Emergency Mode ON" : "Emergency Mode"}
                  </Button>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ApperIcon name="X" size={24} />
                  </button>
                </div>
              </div>

              {/* Monitoring Status Bar */}
              {monitoringData.submissionAttempts > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ApperIcon name="BarChart3" size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Submission Monitor
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-blue-700">
                      <span>Attempts: {monitoringData.submissionAttempts}</span>
                      <span>Success Rate: {monitoringData.submissionAttempts > 0 ? 
                        (((monitoringData.submissionAttempts - monitoringData.failedSubmissions) / monitoringData.submissionAttempts * 100).toFixed(1)) : 100}%</span>
                      {monitoringData.failedSubmissions > 0 && (
                        <span className="text-red-600 font-medium">
                          Failures: {monitoringData.failedSubmissions}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Mode Warning */}
              {emergencyMode && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <ApperIcon name="AlertTriangle" size={20} className="text-red-600 mt-0.5" />
                    <div>
                      <h4 className="text-red-800 font-medium">Emergency Mode Active</h4>
                      <p className="text-red-700 text-sm mt-1">
                        Products can be created without images. This should only be used during critical situations 
                        when image upload is consistently failing.
                      </p>
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEmergencyMode(false)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Disable Emergency Mode
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 space-y-8">
              {/* 1. Basic Info Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="Package" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Product Name *"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    icon="Package"
                    placeholder="Enter product name"
                  />
                  
                  {/* Enhanced Category with Nested Subcategories */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select Category</option>
                      <optgroup label="Food & Beverages">
                        <option value="Groceries">Groceries</option>
                        <option value="Fruits">Fresh Fruits</option>
                        <option value="Vegetables">Fresh Vegetables</option>
                        <option value="Meat">Meat & Poultry</option>
                        <option value="Dairy">Dairy Products</option>
                        <option value="Bakery">Bakery Items</option>
                        <option value="Beverages">Beverages</option>
                      </optgroup>
                      <optgroup label="Household">
                        <option value="Cleaning">Cleaning Supplies</option>
                        <option value="Personal Care">Personal Care</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Global Visibility Toggle */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ApperIcon name="Eye" size={20} className="text-blue-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">Global Visibility</h4>
                        <p className="text-sm text-gray-600">Control whether this product is visible to customers</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.isVisible !== false}
                      onChange={(checked) => setFormData(prev => ({ ...prev, isVisible: checked }))}
                      color="primary"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Pricing Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="DollarSign" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Pricing & Profit Calculator</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Base Price (Rs.) *"
                    name="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    icon="DollarSign"
                    placeholder="0.00"
                  />
                  <Input
                    label="Cost Price (Rs.) *"
                    name="purchasePrice"
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    required
                    icon="ShoppingCart"
                    placeholder="0.00"
                  />
                </div>

                {/* Profit Calculator Display */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        Rs. {formData.minSellingPrice || '0.00'}
                      </div>
                      <div className="text-sm text-gray-600">Min Selling Price</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formData.profitMargin || '0.00'}%
                      </div>
                      <div className="text-sm text-gray-600">Profit Margin</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        Rs. {formData.price && formData.purchasePrice ? 
                          (parseFloat(formData.price) - parseFloat(formData.purchasePrice)).toFixed(2) : '0.00'}
                      </div>
                      <div className="text-sm text-gray-600">Profit Amount</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Inventory Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="Archive" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Management</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Stock Quantity *"
                    name="stock"
                    type="number"
                    value={formData.stock}
                    onChange={handleInputChange}
                    required
                    icon="Archive"
                    placeholder="0"
                  />
                  <Input
                    label="Low Stock Alert"
                    name="minStock"
                    type="number"
                    value={formData.minStock}
                    onChange={handleInputChange}
                    placeholder="5"
                    icon="AlertTriangle"
                  />
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Unit *
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="">Select Unit</option>
                      <optgroup label="Weight">
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="litre">Litre (L)</option>
                        <option value="ml">Millilitre (ml)</option>
                      </optgroup>
                      <optgroup label="Count">
                        <option value="piece">Piece (pcs)</option>
                        <option value="pack">Pack</option>
                        <option value="dozen">Dozen</option>
                        <option value="box">Box</option>
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Stock Status Indicator */}
                {formData.stock && formData.minStock && (
                  <div className={`p-3 rounded-lg border ${
                    parseInt(formData.stock) <= parseInt(formData.minStock) 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <ApperIcon 
                        name={parseInt(formData.stock) <= parseInt(formData.minStock) ? "AlertTriangle" : "CheckCircle"} 
                        size={16} 
                        className={parseInt(formData.stock) <= parseInt(formData.minStock) ? "text-red-600" : "text-green-600"} 
                      />
                      <span className={`text-sm font-medium ${
                        parseInt(formData.stock) <= parseInt(formData.minStock) ? "text-red-800" : "text-green-800"
                      }`}>
                        {parseInt(formData.stock) <= parseInt(formData.minStock) 
                          ? "Low Stock Alert!" 
                          : "Stock Level Normal"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Enhanced Variations Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="Settings" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Product Variations</h3>
                </div>

                {/* Enable Variations Checkbox */}
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableVariations"
                        checked={formData.enableVariations || false}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          enableVariations: e.target.checked,
                          variations: e.target.checked ? (prev.variations || []) : []
                        }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="enableVariations" className="cursor-pointer">
                        <h4 className="font-medium text-gray-900">Enable Variations</h4>
                        <p className="text-sm text-gray-600">Create product variants like size, color, or material</p>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Enhanced Variation Groups */}
                {formData.enableVariations && (
                  <div className="space-y-6">
                    {(formData.variations || []).map((variation, index) => (
                      <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-gray-900">Variation Group {index + 1}</h5>
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon="Copy"
                              onClick={() => {
                                const clonedVariation = { ...variation };
                                const newVariations = [...(formData.variations || [])];
                                newVariations.splice(index + 1, 0, clonedVariation);
                                setFormData(prev => ({ ...prev, variations: newVariations }));
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Clone
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon="Trash2"
                              onClick={() => {
                                const newVariations = [...(formData.variations || [])];
                                newVariations.splice(index, 1);
                                setFormData(prev => ({ ...prev, variations: newVariations }));
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Variation Type
                            </label>
                            <select
                              value={variation.type || ''}
                              onChange={(e) => {
                                const newVariations = [...(formData.variations || [])];
                                newVariations[index] = { ...variation, type: e.target.value };
                                setFormData(prev => ({ ...prev, variations: newVariations }));
                              }}
                              className="input-field"
                            >
                              <option value="">Select Type</option>
                              <option value="Color">Color</option>
                              <option value="Size">Size</option>
                              <option value="Material">Material</option>
                              <option value="Weight">Weight</option>
                              <option value="Style">Style</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Options (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={variation.options || ''}
                              onChange={(e) => {
                                const newVariations = [...(formData.variations || [])];
                                newVariations[index] = { ...variation, options: e.target.value };
                                setFormData(prev => ({ ...prev, variations: newVariations }));
                              }}
                              placeholder="e.g., Red, Blue, Green or S, M, L, XL"
                              className="input-field"
                            />
                          </div>
                        </div>

                        {/* Price Override Toggle */}
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id={`priceOverride-${index}`}
                                checked={variation.enablePriceOverride || false}
                                onChange={(e) => {
                                  const newVariations = [...(formData.variations || [])];
                                  newVariations[index] = { 
                                    ...variation, 
                                    enablePriceOverride: e.target.checked,
                                    customPrice: e.target.checked ? (variation.customPrice || formData.price) : null
                                  };
                                  setFormData(prev => ({ ...prev, variations: newVariations }));
                                }}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label htmlFor={`priceOverride-${index}`} className="cursor-pointer">
                                <h6 className="font-medium text-gray-900">Price Override</h6>
                                <p className="text-sm text-gray-600">Set different price from base price (Rs. {formData.price || 0})</p>
                              </label>
                            </div>
                            {variation.enablePriceOverride && (
                              <div className="space-y-2">
                                <Input
                                  label="Custom Price (Rs.)"
                                  type="number"
                                  step="0.01"
                                  value={variation.customPrice || ''}
                                  onChange={(e) => {
                                    const newVariations = [...(formData.variations || [])];
                                    newVariations[index] = { ...variation, customPrice: e.target.value };
                                    setFormData(prev => ({ ...prev, variations: newVariations }));
                                  }}
                                  placeholder={formData.price || '0'}
                                  className="w-32"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Display parsed options */}
                        {variation.options && (
                          <div className="flex flex-wrap gap-2">
                            {variation.options.split(',').map((option, optIndex) => (
                              <span
                                key={optIndex}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                              >
                                {option.trim()}
                                {variation.enablePriceOverride && variation.customPrice && (
                                  <span className="ml-2 text-green-600">Rs. {variation.customPrice}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Matrix View for Color x Size Combinations */}
                    <VariationMatrixView 
                      variations={formData.variations || []}
                      basePrice={formData.price}
                      productName={formData.name}
                      onMatrixUpdate={(matrixData) => {
                        setFormData(prev => ({ ...prev, variationMatrix: matrixData }));
                      }}
                    />

                    {/* Add Variation Group Button */}
                    <Button
                      type="button"
                      variant="outline"
                      icon="Plus"
                      onClick={() => {
                        const newVariation = { 
                          type: '', 
                          options: '', 
                          enablePriceOverride: false,
                          customPrice: null
                        };
                        setFormData(prev => ({ 
                          ...prev, 
                          variations: [...(prev.variations || []), newVariation]
                        }));
                      }}
                      className="w-full"
                    >
                      Add Variation Group
                    </Button>
                  </div>
                )}
              </div>

              {/* 5. Enhanced Offers & Discounts Management */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="Tag" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Offers & Auto-Apply Rules</h3>
                </div>

                {/* Auto-Apply Rules Section */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <ApperIcon name="Zap" size={20} className="text-purple-600" />
                    <h4 className="font-medium text-gray-900">Auto-Apply Offer Rules</h4>
                    <Badge variant="featured" className="text-xs">Smart Automation</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableRamadanOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableRamadanOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable during Ramadan</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableEidOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableEidOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable during Eid celebrations</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableWeekendOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableWeekendOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Weekend special offers</span>
                      </label>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableLowStockOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableLowStockOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Auto-apply when low stock</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableBulkOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableBulkOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Bulk purchase incentives</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.enableSeasonalOffer || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, enableSeasonalOffer: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Seasonal promotions</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Badge Generator Section */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <ApperIcon name="Award" size={20} className="text-orange-600" />
                    <h4 className="font-medium text-gray-900">Auto Badge Generator</h4>
                    <Badge variant="promotional" className="text-xs">Live Preview</Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Badge Text Template"
                        name="badgeTemplate"
                        value={formData.badgeTemplate || "Eid Sale: {discount}% OFF"}
                        onChange={handleInputChange}
                        placeholder="e.g., Eid Sale: 30% OFF"
                      />
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Badge Style</label>
                        <select
                          name="badgeStyle"
                          value={formData.badgeStyle || 'promotional'}
                          onChange={handleInputChange}
                          className="input-field"
                        >
                          <option value="promotional">Promotional (Animated)</option>
                          <option value="sale">Sale (Gradient Red)</option>
                          <option value="featured">Featured (Purple Gradient)</option>
                          <option value="offer">Special Offer (Green-Blue)</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Live Badge Preview */}
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Live Preview:</span>
                        <Badge 
                          variant={formData.badgeStyle || 'promotional'} 
                          className="text-sm font-bold"
                        >
                          {formData.badgeTemplate?.replace('{discount}', formData.discountValue || '30') || 'Eid Sale: 30% OFF'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Discount Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Discount Type
                    </label>
                    <select
                      name="discountType"
                      value={formData.discountType}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="Fixed Amount">Fixed Amount (Rs.)</option>
                      <option value="Percentage">Percentage (%)</option>
                    </select>
                  </div>
                  
                  <Input
                    label={`Discount Value ${formData.discountType === 'Percentage' ? '(%)' : '(Rs.)'}`}
                    name="discountValue"
                    type="number"
                    step={formData.discountType === 'Percentage' ? "0.1" : "0.01"}
                    max={formData.discountType === 'Percentage' ? "100" : undefined}
                    value={formData.discountValue}
                    onChange={handleInputChange}
                    icon="Tag"
                    placeholder="0"
                  />
                </div>

                {/* Enhanced Date Range with Validation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Offer Start Date"
                    name="discountStartDate"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.discountStartDate || ''}
                    onChange={handleInputChange}
                    icon="Calendar"
                  />
                  <Input
                    label="Offer End Date"
                    name="discountEndDate"
                    type="date"
                    min={formData.discountStartDate || new Date().toISOString().split('T')[0]}
                    value={formData.discountEndDate || ''}
                    onChange={handleInputChange}
                    icon="Calendar"
                  />
                </div>

                {/* Priority & Auto-Apply Logic */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Priority Level (for overlapping offers)
                    </label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={formData.discountPriority || 1}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          discountPriority: parseInt(e.target.value) 
                        }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Low (1)</span>
                        <span className="font-medium text-primary">
                          Priority: {formData.discountPriority || 1}
                        </span>
                        <span>High (5)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Auto-Apply Conditions
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.autoApplyForNewCustomers || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, autoApplyForNewCustomers: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">New customers only</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          checked={formData.autoApplyMinimumOrder || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, autoApplyMinimumOrder: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Minimum order amount</span>
                      </label>
                      {formData.autoApplyMinimumOrder && (
                        <Input
                          label="Minimum Amount (Rs.)"
                          name="minimumOrderAmount"
                          type="number"
                          value={formData.minimumOrderAmount || ''}
                          onChange={handleInputChange}
                          placeholder="1000"
                          className="mt-2"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Enhanced Discount Preview with Strikethrough */}
                {formData.price && formData.discountValue && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-lg border border-orange-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-gray-900 flex items-center space-x-2">
                            <ApperIcon name="Eye" size={16} />
                            <span>Offer Preview</span>
                          </h5>
                          <div className="flex items-center space-x-4 mt-2">
                            <Badge variant="strikethrough" className="text-lg">
                              Rs. {formData.price}
                            </Badge>
                            <Badge variant="sale" className="text-lg font-bold">
                              Rs. {(() => {
                                const price = parseFloat(formData.price);
                                const discount = parseFloat(formData.discountValue) || 0;
                                if (formData.discountType === 'Percentage') {
                                  return (price - (price * discount / 100)).toFixed(2);
                                }
                                return (price - discount).toFixed(2);
                              })()}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={formData.badgeStyle || 'promotional'} 
                            className="text-lg font-bold mb-2"
                          >
                            {formData.badgeTemplate?.replace('{discount}', formData.discountValue) || 
                             (formData.discountType === 'Percentage' ? 
                               `${formData.discountValue}% OFF` : 
                               `Rs. ${formData.discountValue} OFF`)}
                          </Badge>
                          <div className="text-sm text-gray-600">
                            You save: Rs. {(() => {
                              const price = parseFloat(formData.price);
                              const discount = parseFloat(formData.discountValue) || 0;
                              if (formData.discountType === 'Percentage') {
                                return (price * discount / 100).toFixed(2);
                              }
                              return discount.toFixed(2);
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Additional Information */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
                  <ApperIcon name="FileText" size={20} className="text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                </div>

                <Input
                  label="Product Description"
                  name="description"
                  type="textarea"
                  placeholder="Detailed product description..."
                  value={formData.description}
                  onChange={handleInputChange}
                  icon="FileText"
                />

                {/* Conditional Image Upload System */}
                {!emergencyMode && (
                  <ImageUploadSystem
                    imageData={imageData}
                    setImageData={setImageData}
                    onImageUpload={handleImageUpload}
                    onImageSearch={handleImageSearch}
                    onImageSelect={handleImageSelect}
                    onAIImageGenerate={handleAIImageGenerate}
                    formData={formData}
                  />
                )}

                {/* Emergency Mode Image Placeholder */}
                {emergencyMode && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-3">
                      <ApperIcon name="ImageOff" size={20} className="text-yellow-600" />
                      <div>
                        <h4 className="font-medium text-yellow-800">No Image Required (Emergency Mode)</h4>
                        <p className="text-yellow-700 text-sm">
                          Product will be created with default placeholder image. You can add an image later.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Input
                  label="Barcode"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  icon="BarChart"
                  placeholder="Auto-generated if left empty"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  icon="Save"
                  className={emergencyMode ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                >
                  {editingProduct ? "Update Product" : (emergencyMode ? "Add Product (No Image)" : "Add Product")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Update Modal */}
      {/* Enhanced Bulk Actions Modal */}
      {showBulkPriceModal && (
        <EnhancedBulkActionsModal
          products={products}
          categories={categories}
          onUpdate={handleBulkPriceUpdate}
          onClose={() => setShowBulkPriceModal(false)}
        />
      )}
      </div>
      )}
    </div>
  );
};

// Enhanced Bulk Actions Modal with Category Discounts and Validation
const EnhancedBulkActionsModal = ({ products, categories, onUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState('pricing');
  const [updateData, setUpdateData] = useState({
    strategy: 'percentage',
    value: '',
    minPrice: '',
    maxPrice: '',
    category: 'all',
    applyToLowStock: false,
    stockThreshold: 10,
    // Enhanced discount options
    discountType: 'percentage',
    discountValue: '',
    discountStartDate: '',
    discountEndDate: '',
    categoryDiscount: false,
    overrideExisting: false,
    conflictResolution: 'skip' // skip, override, merge
  });
  const [preview, setPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [conflictAnalysis, setConflictAnalysis] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUpdateData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setShowPreview(false);
    setValidationResults([]);
  };

  // Enhanced validation with conflict detection
  const runValidation = async () => {
    try {
      if (!Array.isArray(products) || products.length === 0) {
        toast.error('No products available for validation');
        return;
      }

      let filteredProducts = [...products];
      
      // Filter by category
      if (updateData.category !== 'all') {
        filteredProducts = filteredProducts.filter(p => p && p.category === updateData.category);
      }

const validationPromises = filteredProducts.map(async (product) => {
        const conflicts = await productService.validatePricingHierarchy(product, products, product.id);
        return {
          productId: product.id,
          productName: product.name,
          isValid: conflicts.isValid,
          conflicts: conflicts.conflicts || [],
          warnings: conflicts.warnings || []
        };
      });

      const results = await Promise.all(validationPromises);
      setValidationResults(results);

      const conflictCount = results.filter(r => !r.isValid).length;
      const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

      setConflictAnalysis({
        totalProducts: filteredProducts.length,
        conflictCount,
        warningCount,
        cleanProducts: filteredProducts.length - conflictCount
      });

      toast.success(`Validation complete: ${conflictCount} conflicts, ${warningCount} warnings found`);
    } catch (error) {
      console.error('Error running validation:', error);
      toast.error('Failed to run validation');
    }
  };

  const generatePreview = () => {
    try {
      if (!Array.isArray(products) || products.length === 0) {
        toast.error('No products available for update');
        return;
      }

      let filteredProducts = [...products];
      
      // Filter by category with null safety
      if (updateData.category !== 'all') {
        filteredProducts = filteredProducts.filter(p => p && p.category === updateData.category);
      }
      
      // Filter by stock if enabled
      if (updateData.applyToLowStock) {
        const threshold = parseInt(updateData.stockThreshold) || 10;
        filteredProducts = filteredProducts.filter(p => p && p.stock <= threshold);
      }

      if (filteredProducts.length === 0) {
        toast.error('No products match the selected criteria');
        return;
      }

      const previews = filteredProducts.map(product => {
        if (!product || typeof product.price !== 'number') {
          return {
            ...product,
            newPrice: product?.price || 0,
            priceChange: 0,
            hasConflicts: false
          };
        }

        let newPrice = product.price;
        let hasDiscount = false;
        
        // Handle pricing strategy
        if (activeTab === 'pricing') {
          switch (updateData.strategy) {
            case 'percentage':
              const percentage = parseFloat(updateData.value) || 0;
              newPrice = product.price * (1 + percentage / 100);
              break;
            case 'fixed':
              const fixedAmount = parseFloat(updateData.value) || 0;
              newPrice = product.price + fixedAmount;
              break;
            case 'range':
              const minPrice = parseFloat(updateData.minPrice) || 0;
              const maxPrice = parseFloat(updateData.maxPrice) || product.price;
              newPrice = Math.min(Math.max(product.price, minPrice), maxPrice);
              break;
            default:
              newPrice = product.price;
          }
        }

        // Handle category-wide discounts
        if (activeTab === 'discounts' && updateData.categoryDiscount) {
          const discountValue = parseFloat(updateData.discountValue) || 0;
          if (discountValue > 0) {
            if (updateData.discountType === 'percentage') {
              newPrice = product.price * (1 - discountValue / 100);
            } else {
              newPrice = product.price - discountValue;
            }
            hasDiscount = true;
          }
        }

        // Apply min/max price guards
        if (updateData.minPrice && newPrice < parseFloat(updateData.minPrice)) {
          newPrice = parseFloat(updateData.minPrice);
        }
        if (updateData.maxPrice && newPrice > parseFloat(updateData.maxPrice)) {
          newPrice = parseFloat(updateData.maxPrice);
        }

        // Ensure price is never negative or below Rs. 1
        newPrice = Math.max(1, newPrice);

        // Check for conflicts with existing offers
        const hasConflicts = product.discountValue > 0 && hasDiscount && !updateData.overrideExisting;

        return {
          ...product,
          newPrice: Math.round(newPrice * 100) / 100,
          priceChange: Math.round((newPrice - product.price) * 100) / 100,
          hasDiscount,
          hasConflicts,
          conflictType: hasConflicts ? 'existing_discount' : null
        };
      });

      setPreview(previews);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview. Please try again.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    try {
      if (activeTab === 'pricing' && !updateData.value && updateData.strategy !== 'range') {
        toast.error('Please enter a value for the price update');
        return;
      }

      if (activeTab === 'discounts' && updateData.categoryDiscount && !updateData.discountValue) {
        toast.error('Please enter a discount value');
        return;
      }

      if (updateData.strategy === 'range' && (!updateData.minPrice || !updateData.maxPrice)) {
        toast.error('Please enter both minimum and maximum prices');
        return;
      }

      if (updateData.strategy === 'range') {
        const minPrice = parseFloat(updateData.minPrice);
        const maxPrice = parseFloat(updateData.maxPrice);
        if (minPrice >= maxPrice) {
          toast.error('Maximum price must be greater than minimum price');
          return;
        }
      }

      if (!showPreview || preview.length === 0) {
        toast.error('Please generate a preview first');
        return;
      }

      // Check for conflicts in preview
      const conflictProducts = preview.filter(p => p.hasConflicts);
      if (conflictProducts.length > 0 && updateData.conflictResolution === 'skip') {
        const message = `${conflictProducts.length} products have existing discounts. Choose conflict resolution strategy.`;
        toast.warning(message);
        return;
      }

      const confirmMessage = `Are you sure you want to update ${preview.length} products?`;
      if (window.confirm(confirmMessage)) {
        // Enhanced update data with conflict resolution
        const enhancedUpdateData = {
          ...updateData,
          activeTab,
          conflictResolution: updateData.conflictResolution,
          previewData: preview
        };
        onUpdate(enhancedUpdateData);
      }
    } catch (error) {
      console.error('Error submitting bulk update:', error);
      toast.error('Failed to process bulk update');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Enhanced Bulk Actions & Validation</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ApperIcon name="X" size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mt-4">
            {[
              { id: 'pricing', label: 'Price Updates', icon: 'DollarSign' },
              { id: 'discounts', label: 'Category Discounts', icon: 'Tag' },
              { id: 'validation', label: 'Conflict Detection', icon: 'Shield' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ApperIcon name={tab.icon} size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
</div>

        <div className="p-6 space-y-6">
          {/* Price Updates Tab */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Update Strategy
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
<input
                    type="radio"
                    name="strategy"
                    value="percentage"
                    checked={updateData.strategy === 'percentage'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <label className="text-sm text-gray-700">Percentage Change</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="strategy"
                    value="fixed"
                    checked={updateData.strategy === 'fixed'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <label className="text-sm text-gray-700">Fixed Amount</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="strategy"
                    value="range"
                    checked={updateData.strategy === 'range'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <label className="text-sm text-gray-700">Price Range</label>
                </div>
              </div>
            </div>

            {/* Strategy-specific inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {updateData.strategy === 'percentage' && (
                <Input
                  label="Percentage Change (%)"
                  name="value"
                  type="number"
                  step="0.1"
                  value={updateData.value}
                  onChange={handleInputChange}
                  placeholder="e.g., 10 for 10% increase, -5 for 5% decrease"
                  icon="Percent"
                />
              )}
              
              {updateData.strategy === 'fixed' && (
                <Input
                  label="Fixed Amount (Rs.)"
                  name="value"
                  type="number"
                  step="0.01"
                  value={updateData.value}
                  onChange={handleInputChange}
                  placeholder="e.g., 50 to add Rs. 50, -25 to subtract Rs. 25"
                  icon="DollarSign"
                />
              )}

              {updateData.strategy === 'range' && (
                <>
                  <Input
                    label="Minimum Price (Rs.)"
                    name="minPrice"
                    type="number"
                    step="0.01"
                    min="1"
                    value={updateData.minPrice}
                    onChange={handleInputChange}
                    icon="TrendingDown"
                  />
                  <Input
                    label="Maximum Price (Rs.)"
                    name="maxPrice"
                    type="number"
                    step="0.01"
                    max="100000"
                    value={updateData.maxPrice}
                    onChange={handleInputChange}
                    icon="TrendingUp"
                  />
                </>
              )}
            </div>

            {/* Price Guards */}
            {updateData.strategy !== 'range' && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <ApperIcon name="Shield" size={16} />
                  <span>Price Guards</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Minimum Price Limit (Rs.)"
                    name="minPrice"
                    type="number"
                    step="0.01"
                    min="1"
                    value={updateData.minPrice}
                    onChange={handleInputChange}
                    placeholder="Min: Rs. 1"
                    icon="TrendingDown"
                  />
                  <Input
                    label="Maximum Price Limit (Rs.)"
                    name="maxPrice"
                    type="number"
                    step="0.01"
                    max="100000"
                    value={updateData.maxPrice}
                    onChange={handleInputChange}
                    placeholder="Max: Rs. 100,000"
                    icon="TrendingUp"
                  />
                </div>
              </div>
            )}
          </div>
          )}

          {/* Category Discounts Tab */}
          {activeTab === 'discounts' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-2 mb-4">
                  <ApperIcon name="Tag" size={20} className="text-purple-600" />
                  <h4 className="font-medium text-gray-900">Category-Wide Discount Application</h4>
                  <Badge variant="promotional" className="text-xs">Bulk Actions</Badge>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="categoryDiscount"
                      checked={updateData.categoryDiscount}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Apply discount to entire category
                    </label>
                  </div>

                  {updateData.categoryDiscount && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Discount Type</label>
                          <select
                            name="discountType"
                            value={updateData.discountType}
                            onChange={handleInputChange}
                            className="input-field"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount (Rs.)</option>
                          </select>
                        </div>
                        
                        <Input
                          label={`Discount Value ${updateData.discountType === 'percentage' ? '(%)' : '(Rs.)'}`}
                          name="discountValue"
                          type="number"
                          step={updateData.discountType === 'percentage' ? "0.1" : "0.01"}
                          max={updateData.discountType === 'percentage' ? "90" : undefined}
                          value={updateData.discountValue}
                          onChange={handleInputChange}
                          icon="Tag"
                          placeholder="0"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Discount Start Date"
                          name="discountStartDate"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={updateData.discountStartDate}
                          onChange={handleInputChange}
                          icon="Calendar"
                        />
                        <Input
                          label="Discount End Date"
                          name="discountEndDate"
                          type="date"
                          min={updateData.discountStartDate || new Date().toISOString().split('T')[0]}
                          value={updateData.discountEndDate}
                          onChange={handleInputChange}
                          icon="Calendar"
                        />
                      </div>

                      {/* Conflict Resolution */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-900 mb-3">Conflict Resolution</h5>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="conflictResolution"
                              value="skip"
                              checked={updateData.conflictResolution === 'skip'}
                              onChange={handleInputChange}
                              className="text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700">Skip products with existing discounts</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="conflictResolution"
                              value="override"
                              checked={updateData.conflictResolution === 'override'}
                              onChange={handleInputChange}
                              className="text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700">Override existing discounts</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="conflictResolution"
                              value="merge"
                              checked={updateData.conflictResolution === 'merge'}
                              onChange={handleInputChange}
                              className="text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700">Merge with existing discounts (highest wins)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Validation Tab */}
          {activeTab === 'validation' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <ApperIcon name="Shield" size={20} className="text-green-600" />
                    <h4 className="font-medium text-gray-900">Offer Conflict Detection</h4>
                    <Badge variant="success" className="text-xs">Real-time</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    icon="Play"
                    onClick={runValidation}
                  >
                    Run Validation
                  </Button>
                </div>

                {conflictAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{conflictAnalysis.totalProducts}</div>
                      <div className="text-sm text-gray-600">Total Products</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{conflictAnalysis.conflictCount}</div>
                      <div className="text-sm text-gray-600">Conflicts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{conflictAnalysis.warningCount}</div>
                      <div className="text-sm text-gray-600">Warnings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{conflictAnalysis.cleanProducts}</div>
                      <div className="text-sm text-gray-600">Clean Products</div>
                    </div>
                  </div>
                )}

                {validationResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {validationResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          result.isValid
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{result.productName}</span>
                          <Badge variant={result.isValid ? "success" : "error"} className="text-xs">
                            {result.isValid ? 'Valid' : 'Conflicts'}
                          </Badge>
                        </div>
                        {result.conflicts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {result.conflicts.map((conflict, cIndex) => (
                              <div key={cIndex} className="text-sm text-red-700">
                                • {conflict.type}: {conflict.details}
                              </div>
                            ))}
                          </div>
                        )}
                        {result.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {result.warnings.map((warning, wIndex) => (
                              <div key={wIndex} className="text-sm text-yellow-700">
                                ⚠ {warning}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shared Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Category Filter
              </label>
              <select
                name="category"
                value={updateData.category}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="all">All Categories</option>
                {Array.isArray(categories) && categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="applyToLowStock"
                  checked={updateData.applyToLowStock}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label className="text-sm font-medium text-gray-700">
                  Apply only to low stock items
                </label>
              </div>
              {updateData.applyToLowStock && (
                <Input
                  label="Stock Threshold"
                  name="stockThreshold"
                  type="number"
                  value={updateData.stockThreshold}
                  onChange={handleInputChange}
                  icon="Archive"
                />
              )}
            </div>
          </div>

          {/* Preview Button */}
          {activeTab !== 'validation' && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                icon="Eye"
                onClick={generatePreview}
                disabled={
                  (activeTab === 'pricing' && !updateData.value && updateData.strategy !== 'range') ||
                  (activeTab === 'discounts' && updateData.categoryDiscount && !updateData.discountValue)
                }
              >
                Preview Changes
              </Button>
            </div>
          )}

          {/* Preview Results */}
          {showPreview && preview.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-3">
                Preview: {preview.length} products will be updated
              </h3>
              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {preview.slice(0, 10).map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.imageUrl || "/api/placeholder/32/32"}
                          alt={product.name || "Product"}
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => {
                            e.target.src = "/api/placeholder/32/32";
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name || "Unnamed Product"}</p>
                          <p className="text-xs text-gray-500">{product.category || "No Category"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Rs. {product.price || 0}</span>
                          <ApperIcon name="ArrowRight" size={12} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">Rs. {product.newPrice || 0}</span>
                        </div>
                        <p className={`text-xs ${(product.priceChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(product.priceChange || 0) >= 0 ? '+' : ''}Rs. {product.priceChange || 0}
                        </p>
                      </div>
                    </div>
                  ))}
                  {preview.length > 10 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... and {preview.length - 10} more products
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon="Save"
              disabled={!showPreview || preview.length === 0}
            >
              Update {preview.length} Products
</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Intelligent Image Upload System Component
const ImageUploadSystem = ({
  imageData, 
  setImageData, 
  onImageUpload, 
  onImageSelect,
  onImageSearch,
  onAIImageGenerate,
  formData
}) => {
const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

// Handle image selection from search results or AI generation
  const handleLocalImageSelect = (imageUrl) => {
    try {
      if (!imageUrl) {
        toast.error('Invalid image URL');
        return;
      }
      
      const urlString = typeof imageUrl === 'string' ? imageUrl : imageUrl.toString();
      
      setImageData(prev => ({ 
        ...prev, 
        selectedImage: urlString,
        isProcessing: false 
      }));
      
      if (onImageSelect) {
        onImageSelect(urlString);
      }
      
      toast.success('✓ Image selected!');
    } catch (error) {
      console.error('Error selecting image:', error);
      toast.error('Failed to select image');
    }
  };
  // Handle AI image generation

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file) => {
// Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    
    if (onImageUpload) {
      onImageUpload(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };


  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Product Image *
      </label>
      
      {/* Tab Navigation */}
{/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
        {[
          { id: 'upload', label: 'Upload', icon: 'Upload' },
          { id: 'search', label: 'Search', icon: 'Search' },
          { id: 'ai-generate', label: 'AI Generate', icon: 'Sparkles' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setImageData(prev => ({ ...prev, activeTab: tab.id }))}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              (imageData.activeTab || 'upload') === tab.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ApperIcon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Upload Tab */}
{/* Upload Tab */}
      {(imageData.activeTab || 'upload') === 'upload' && (
        <div className="space-y-4">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-3">
              <div className={`p-3 rounded-full ${dragActive ? 'bg-primary/10' : 'bg-gray-100'}`}>
                <ApperIcon 
                  name={dragActive ? "Download" : "ImagePlus"} 
                  size={32} 
                  className={dragActive ? 'text-primary' : 'text-gray-400'}
                />
              </div>
              
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {dragActive ? 'Drop image here' : 'Upload product image (1:1 ratio recommended)'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag & drop or click to browse • Accepts JPG, PNG, WEBP, HEIC
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                <span>JPG</span>
                <span>PNG</span>
                <span>WEBP</span>
                <span>HEIC</span>
              </div>
            </div>
          </div>

          {/* Upload Progress */}

          {/* Image Preview & Cropping */}
          {imageData.selectedImage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Image Preview</h4>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="RotateCcw"
                    onClick={() => {
                      // Clean up URL if it's a blob URL
                      if (imageData.selectedImage && imageData.selectedImage.startsWith('blob:')) {
                        try {
                          URL.revokeObjectURL(imageData.selectedImage);
                        } catch (error) {
                          console.warn('Failed to revoke URL:', error);
                        }
                      }
                      setImageData(prev => ({ ...prev, selectedImage: null, croppedImage: null }));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <img
                  src={imageData.selectedImage}
                  alt="Product preview"
                  className="w-full max-w-md mx-auto rounded-lg shadow-md"
                  style={{ maxHeight: '300px', objectFit: 'cover', aspectRatio: '1/1' }}
                />
                
                {/* 1:1 Aspect Ratio Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner Markers for 1:1 Boundaries */}
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                  
                  {/* 1:1 Ratio Badge */}
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-white px-3 py-1 rounded-full text-xs font-medium shadow-md">
                    <div className="flex items-center space-x-1">
                      <ApperIcon name="CheckCircle" size={12} />
                      <span>1:1 Ratio</span>
                    </div>
                  </div>
                  
                  {/* Ready Badge */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-success text-white px-2 py-1 rounded text-xs">
                    ✓ Ready
                  </div>
                </div>
              </div>
              
              {/* Enhanced Image Optimization Settings */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg space-y-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-900 flex items-center space-x-2">
                    <ApperIcon name="Settings" size={16} />
                    <span>Optimization & Quality Settings</span>
                  </h5>
                  <Badge variant="success" className="text-xs">
                    Validated
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <ApperIcon name="Maximize2" size={14} className="text-gray-500" />
                    <div>
                      <span className="text-gray-600">Target Size:</span>
                      <span className="ml-2 font-medium">600 x 600px</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ApperIcon name="HardDrive" size={14} className="text-gray-500" />
                    <div>
                      <span className="text-gray-600">Max File Size:</span>
                      <span className="ml-2 font-medium">≤ 100KB</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ApperIcon name="Square" size={14} className="text-gray-500" />
                    <div>
                      <span className="text-gray-600">Aspect Ratio:</span>
                      <span className="ml-2 font-medium">1:1 (Square)</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ApperIcon name="FileImage" size={14} className="text-gray-500" />
                    <div>
                      <span className="text-gray-600">Format:</span>
                      <span className="ml-2 font-medium">WebP/JPEG</span>
                    </div>
                  </div>
                </div>
                
                {/* Quality Assessment Indicators */}
                <div className="bg-white p-3 rounded border space-y-2">
                  <h6 className="text-sm font-medium text-gray-800 flex items-center space-x-1">
                    <ApperIcon name="Shield" size={14} />
                    <span>Quality Assessment</span>
                  </h6>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-gray-600">No watermarks detected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-gray-600">High image sharpness</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-gray-600">Proper resolution</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-gray-600">Clean background</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                    <span className="text-sm text-gray-700">Smart cropping</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                    <span className="text-sm text-gray-700">Remove background</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                    <span className="text-sm text-gray-700">Quality validation</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

{/* Enhanced Unsplash Search Tab */}
      {(imageData.activeTab || 'upload') === 'search' && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Search for images..."
              value={imageData.searchQuery || ''}
              onChange={(e) => setImageData(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="flex-1 input-field"
            />
            <Button
              type="button"
              variant="primary"
              icon="Search"
onClick={() => onImageSearch(imageData.searchQuery || formData.name)}
              disabled={imageData.isProcessing}
            >
              Search
            </Button>
          </div>
          
{imageData.searchResults && imageData.searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {imageData.searchResults.map((imageUrl, index) => (
                <div
                  key={index}
                  className="relative cursor-pointer group"
                  onClick={() => onImageSelect(imageUrl)}
                >
                  <img
                    src={imageUrl}
                    alt={`Search result ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg group-hover:opacity-75 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="primary" size="sm" icon="Check">
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

{/* Enhanced AI Image Generator Tab */}
      {(imageData.activeTab || 'upload') === 'ai-generate' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              AI Image Prompt
            </label>
            <textarea
              placeholder={`Generate an image of ${formData.name || 'a product'} for ${formData.category || 'general'} category...`}
              value={imageData.aiPrompt || ''}
              onChange={(e) => setImageData(prev => ({ ...prev, aiPrompt: e.target.value }))}
              className="w-full h-24 input-field resize-none"
            />
          </div>
          
          <Button
            type="button"
            variant="primary"
            icon="Sparkles"
onClick={() => onAIImageGenerate(imageData.aiPrompt || `${formData.name} ${formData.category}`)}
            disabled={imageData.isProcessing}
            className="w-full"
          >
            {imageData.isProcessing ? 'Generating...' : 'Generate AI Image'}
          </Button>
        </div>
      )}
    </div>
  );
};

// AI Image Generator Component

// Enhanced Variation Matrix View Component
const VariationMatrixView = ({ variations, basePrice, productName, onMatrixUpdate }) => {
  const [matrixData, setMatrixData] = useState({});
  const [showMatrix, setShowMatrix] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [skuPattern, setSkuPattern] = useState('AUTO');

  // Get color and size variations
  const colorVariation = variations.find(v => v.type === 'Color' && v.options);
  const sizeVariation = variations.find(v => v.type === 'Size' && v.options);

  const colors = colorVariation ? colorVariation.options.split(',').map(c => c.trim()) : [];
  const sizes = sizeVariation ? sizeVariation.options.split(',').map(s => s.trim()) : [];

  // Generate SKU based on pattern
  const generateSKU = (color, size) => {
    const productCode = (productName || 'PROD').toUpperCase().slice(0, 4);
    const colorCode = color.toUpperCase().slice(0, 3);
    const sizeCode = size.toUpperCase();
    
    switch (skuPattern) {
      case 'AUTO':
        return `${productCode}-${colorCode}-${sizeCode}`;
      case 'SIMPLE':
        return `${colorCode}${sizeCode}`;
      case 'DETAILED':
        return `${productCode}_${color.toUpperCase()}_${size.toUpperCase()}_${Date.now().toString().slice(-4)}`;
      default:
        return `${productCode}-${colorCode}-${sizeCode}`;
    }
  };

  // Initialize matrix when colors and sizes are available
  useEffect(() => {
    if (colors.length > 0 && sizes.length > 0) {
      const newMatrixData = {};
      colors.forEach(color => {
        newMatrixData[color] = {};
        sizes.forEach(size => {
          const key = `${color}-${size}`;
          newMatrixData[color][size] = matrixData[color]?.[size] || {
            sku: generateSKU(color, size),
            stock: 0,
            price: basePrice,
            enableCustomPrice: false,
            active: true
          };
        });
      });
      setMatrixData(newMatrixData);
      setShowMatrix(true);
      if (onMatrixUpdate) {
        onMatrixUpdate(newMatrixData);
      }
    } else {
      setShowMatrix(false);
    }
  }, [colors.length, sizes.length, basePrice]);

  // Update matrix cell
  const updateMatrixCell = (color, size, field, value) => {
    const newMatrixData = { ...matrixData };
    if (!newMatrixData[color]) newMatrixData[color] = {};
    if (!newMatrixData[color][size]) {
      newMatrixData[color][size] = {
        sku: generateSKU(color, size),
        stock: 0,
        price: basePrice,
        enableCustomPrice: false,
        active: true
      };
    }
    
    newMatrixData[color][size] = {
      ...newMatrixData[color][size],
      [field]: value
    };
    
    setMatrixData(newMatrixData);
    if (onMatrixUpdate) {
      onMatrixUpdate(newMatrixData);
    }
  };

  // Apply bulk stock to all active cells
  const applyBulkStock = () => {
    if (!bulkStockValue || isNaN(bulkStockValue)) return;
    
    const newMatrixData = { ...matrixData };
    colors.forEach(color => {
      sizes.forEach(size => {
        if (newMatrixData[color]?.[size]?.active) {
          newMatrixData[color][size] = {
            ...newMatrixData[color][size],
            stock: parseInt(bulkStockValue)
          };
        }
      });
    });
    
    setMatrixData(newMatrixData);
    setBulkStockValue('');
    if (onMatrixUpdate) {
      onMatrixUpdate(newMatrixData);
    }
  };

  // Generate new SKUs based on pattern
  const regenerateSKUs = () => {
    const newMatrixData = { ...matrixData };
    colors.forEach(color => {
      sizes.forEach(size => {
        if (newMatrixData[color]?.[size]) {
          newMatrixData[color][size] = {
            ...newMatrixData[color][size],
            sku: generateSKU(color, size)
          };
        }
      });
    });
    
    setMatrixData(newMatrixData);
    if (onMatrixUpdate) {
      onMatrixUpdate(newMatrixData);
    }
  };

  if (!showMatrix) {
    return (
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <div className="text-center">
          <ApperIcon name="Grid3x3" size={48} className="text-blue-400 mx-auto mb-4" />
          <h4 className="font-medium text-gray-900 mb-2">Matrix View</h4>
          <p className="text-gray-600 mb-4">
            Add both "Color" and "Size" variation types to enable the matrix view for SKU management
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${colorVariation ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span>Color Variations</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${sizeVariation ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span>Size Variations</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ApperIcon name="Grid3x3" size={24} className="text-blue-600" />
          <div>
            <h4 className="font-medium text-gray-900">Variation Matrix</h4>
            <p className="text-sm text-gray-600">Manage SKUs, stock, and pricing for all combinations</p>
          </div>
        </div>
        <Badge variant="info" className="text-xs">
          {colors.length} × {sizes.length} = {colors.length * sizes.length} SKUs
        </Badge>
      </div>

      {/* Matrix Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">SKU Pattern</label>
          <select
            value={skuPattern}
            onChange={(e) => {
              setSkuPattern(e.target.value);
              setTimeout(regenerateSKUs, 100);
            }}
            className="input-field text-sm"
          >
            <option value="AUTO">Auto (PROD-RED-L)</option>
            <option value="SIMPLE">Simple (REDL)</option>
            <option value="DETAILED">Detailed (PROD_RED_LARGE_1234)</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Bulk Stock Allocation</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={bulkStockValue}
              onChange={(e) => setBulkStockValue(e.target.value)}
              placeholder="Enter stock quantity"
              className="input-field text-sm flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyBulkStock}
              disabled={!bulkStockValue}
            >
              Apply
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Matrix Actions</label>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon="RefreshCw"
              onClick={regenerateSKUs}
            >
              Regen SKUs
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon="Download"
              onClick={() => {
                const csvData = colors.flatMap(color => 
                  sizes.map(size => ({
                    Color: color,
                    Size: size,
                    SKU: matrixData[color]?.[size]?.sku || '',
                    Stock: matrixData[color]?.[size]?.stock || 0,
                    Price: matrixData[color]?.[size]?.price || basePrice,
                    Active: matrixData[color]?.[size]?.active || true
                  }))
                );
                console.log('Export CSV:', csvData);
              }}
            >
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Color \ Size
                </th>
                {sizes.map(size => (
                  <th
                    key={size}
                    className="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-l"
                  >
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color, colorIndex) => (
                <tr key={color} className={colorIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 text-sm font-medium text-gray-900 border-b">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: color.toLowerCase() }}
                      ></div>
                      <span>{color}</span>
                    </div>
                  </td>
                  {sizes.map(size => {
                    const cellData = matrixData[color]?.[size] || {};
                    return (
                      <td key={`${color}-${size}`} className="p-2 border-b border-l">
                        <div className="space-y-2 min-w-48">
                          {/* SKU */}
                          <div className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {cellData.sku || generateSKU(color, size)}
                          </div>
                          
                          {/* Stock Input */}
                          <input
                            type="number"
                            value={cellData.stock || ''}
                            onChange={(e) => updateMatrixCell(color, size, 'stock', parseInt(e.target.value) || 0)}
                            placeholder="Stock"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          
                          {/* Price Toggle & Input */}
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                checked={cellData.enableCustomPrice || false}
                                onChange={(e) => updateMatrixCell(color, size, 'enableCustomPrice', e.target.checked)}
                                className="text-blue-600 focus:ring-blue-500 rounded"
                              />
                              <span className="text-xs text-gray-600">Custom Price</span>
                            </div>
                            {cellData.enableCustomPrice ? (
                              <input
                                type="number"
                                step="0.01"
                                value={cellData.price || ''}
                                onChange={(e) => updateMatrixCell(color, size, 'price', parseFloat(e.target.value) || 0)}
                                placeholder={basePrice}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                              />
                            ) : (
                              <div className="px-2 py-1 text-sm text-gray-500 bg-gray-50 rounded border">
                                Rs. {basePrice || 0}
                              </div>
                            )}
                          </div>
                          
                          {/* Active Toggle */}
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={cellData.active !== false}
                              onChange={(checked) => updateMatrixCell(color, size, 'active', checked)}
                              color="primary"
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matrix Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-lg border">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {Object.values(matrixData).reduce((total, colorData) => 
              total + Object.values(colorData).filter(cell => cell.active !== false).length, 0
            )}
          </div>
          <div className="text-sm text-gray-600">Active SKUs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {Object.values(matrixData).reduce((total, colorData) => 
              total + Object.values(colorData).reduce((sum, cell) => sum + (cell.stock || 0), 0), 0
            )}
          </div>
          <div className="text-sm text-gray-600">Total Stock</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Object.values(matrixData).reduce((count, colorData) => 
              count + Object.values(colorData).filter(cell => cell.enableCustomPrice).length, 0
            )}
          </div>
          <div className="text-sm text-gray-600">Custom Prices</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            Rs. {Math.round(Object.values(matrixData).reduce((total, colorData) => 
              total + Object.values(colorData).reduce((sum, cell) => 
                sum + ((cell.price || basePrice) * (cell.stock || 0)), 0
              ), 0
))}
          </div>
          <div className="text-sm text-gray-600">Total Value</div>
        </div>
      </div>
    </div>
  );
};
const PreviewMode = ({
  products,
  previewProducts,
  previewDevice,
  setPreviewDevice,
  previewCart,
  setPreviewCart,
  selectedPreviewProduct,
  setSelectedPreviewProduct,
  onExitPreview,
  // Admin panel props
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  showAddForm,
  setShowAddForm,
  editingProduct,
  setEditingProduct,
  showBulkPriceModal,
  setShowBulkPriceModal,
  pendingVisibilityToggles,
  formData,
  setFormData,
  imageData,
  setImageData,
  categories,
  units,
  filteredProducts,
  handleInputChange,
  handleImageUpload,
  handleImageSearch,
  handleImageSelect,
  handleAIImageGenerate,
  handleSubmit,
  handleEdit,
  handleDelete,
  handleVisibilityToggle,
  resetForm,
  handleBulkPriceUpdate
}) => {
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  
  const addToPreviewCart = (product) => {
    const existingItem = previewCart.find(item => item.id === product.id);
    if (existingItem) {
      setPreviewCart(prev => 
        prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setPreviewCart(prev => [...prev, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} added to preview cart!`);
  };

  const removeFromPreviewCart = (productId) => {
    setPreviewCart(prev => prev.filter(item => item.id !== productId));
  };

  const getPreviewCartTotal = () => {
    return previewCart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getPreviewCartCount = () => {
    return previewCart.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                icon="ArrowLeft"
                onClick={onExitPreview}
                className="text-gray-600 hover:text-gray-900"
              >
                Exit Preview
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <ApperIcon name="Eye" size={20} className="text-blue-600" />
                <h1 className="text-lg font-semibold text-gray-900">Live Customer Preview</h1>
                <Badge variant="success" className="text-xs">Real-time</Badge>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Device Switcher */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center space-x-2 px-3 py-1 rounded text-sm font-medium transition-colors ${
                    previewDevice === 'desktop'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ApperIcon name="Monitor" size={16} />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center space-x-2 px-3 py-1 rounded text-sm font-medium transition-colors ${
                    previewDevice === 'mobile'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ApperIcon name="Smartphone" size={16} />
                  <span>Mobile</span>
                </button>
              </div>

              {/* Preview Cart Summary */}
              <div className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">
                <ApperIcon name="ShoppingCart" size={16} />
                <span className="text-sm font-medium">
                  {getPreviewCartCount()} items • Rs. {getPreviewCartTotal().toFixed(2)}
                </span>
              </div>

              {/* Collapse Preview */}
              <Button
                variant="ghost"
                icon={previewCollapsed ? "ChevronUp" : "ChevronDown"}
                onClick={() => setPreviewCollapsed(!previewCollapsed)}
                className="text-gray-600"
              >
                {previewCollapsed ? 'Show' : 'Hide'} Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Split Layout */}
      <div className={`flex ${previewDevice === 'mobile' ? 'flex-col' : 'flex-row'} min-h-[calc(100vh-4rem)]`}>
        {/* Admin Panel - Left Side */}
        <div className={`${previewDevice === 'mobile' ? 'w-full' : previewCollapsed ? 'w-full' : 'w-1/2'} bg-white border-r border-gray-200 overflow-y-auto`}>
          <div className="p-6">
            {/* Admin Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h2>
                <p className="text-gray-600">Manage products - changes appear instantly in customer view</p>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
                <Button
                  variant="secondary"
                  icon="DollarSign"
                  onClick={() => setShowBulkPriceModal(true)}
                  disabled={!products.length}
                >
                  Bulk Price Update
                </Button>
                <Button
                  variant="primary"
                  icon="Plus"
                  onClick={() => setShowAddForm(true)}
                >
                  Add Product
                </Button>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-gray-50 rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Search Products"
                  placeholder="Search by name or barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon="Search"
                />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input-field"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Admin Products Table */}
            <AdminProductsTable
              products={products}
              filteredProducts={filteredProducts}
              categories={categories}
              pendingVisibilityToggles={pendingVisibilityToggles}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
              handleVisibilityToggle={handleVisibilityToggle}
            />
          </div>
        </div>

        {/* Customer Preview - Right Side */}
        {!previewCollapsed && (
          <div className={`${previewDevice === 'mobile' ? 'w-full' : 'w-1/2'} bg-gray-100 overflow-y-auto`}>
            <CustomerPreview
              previewProducts={previewProducts}
              previewDevice={previewDevice}
              previewCart={previewCart}
              selectedPreviewProduct={selectedPreviewProduct}
              setSelectedPreviewProduct={setSelectedPreviewProduct}
              addToPreviewCart={addToPreviewCart}
              removeFromPreviewCart={removeFromPreviewCart}
              getPreviewCartTotal={getPreviewCartTotal}
              getPreviewCartCount={getPreviewCartCount}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showAddForm && (
        <ProductFormModal
          editingProduct={editingProduct}
          formData={formData}
          setFormData={setFormData}
          imageData={imageData}
          setImageData={setImageData}
          categories={categories}
          units={units}
          handleInputChange={handleInputChange}
          handleImageUpload={handleImageUpload}
          handleImageSearch={handleImageSearch}
          handleImageSelect={handleImageSelect}
          handleAIImageGenerate={handleAIImageGenerate}
          handleSubmit={handleSubmit}
          resetForm={resetForm}
        />
      )}

{/* Bulk Price Update Modal */}
      {showBulkPriceModal && (
        <EnhancedBulkActionsModal
          products={products}
          categories={categories}
          onUpdate={handleBulkPriceUpdate}
          onClose={() => setShowBulkPriceModal(false)}
        />
      )}
    </div>
  );
};

// Customer Preview Component
const CustomerPreview = ({
  previewProducts,
  previewDevice,
  previewCart,
  selectedPreviewProduct,
  setSelectedPreviewProduct,
  addToPreviewCart,
  removeFromPreviewCart,
  getPreviewCartTotal,
  getPreviewCartCount
}) => {
  const [previewView, setPreviewView] = useState('grid'); // grid, detail, cart

  return (
    <div className={`h-full ${previewDevice === 'mobile' ? 'max-w-sm mx-auto border-x border-gray-300' : ''}`}>
      {/* Customer Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-primary to-accent p-2 rounded-lg">
                <ApperIcon name="ShoppingBag" size={previewDevice === 'mobile' ? 20 : 24} className="text-white" />
              </div>
              <span className={`${previewDevice === 'mobile' ? 'text-lg' : 'text-2xl'} font-bold gradient-text`}>
                FreshMart
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Preview Cart */}
              <button
                onClick={() => setPreviewView(previewView === 'cart' ? 'grid' : 'cart')}
                className="relative p-2 text-gray-700 hover:text-primary transition-colors"
              >
                <ApperIcon name="ShoppingCart" size={previewDevice === 'mobile' ? 20 : 24} />
                {getPreviewCartCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-secondary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getPreviewCartCount()}
                  </span>
                )}
              </button>

              {/* View Toggle */}
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPreviewView('grid')}
                  className={`p-1 rounded ${previewView === 'grid' ? 'bg-white shadow-sm' : ''}`}
                >
                  <ApperIcon name="Grid3x3" size={16} />
                </button>
                <button
                  onClick={() => setPreviewView('detail')}
                  className={`p-1 rounded ${previewView === 'detail' ? 'bg-white shadow-sm' : ''}`}
                  disabled={!selectedPreviewProduct}
                >
                  <ApperIcon name="Eye" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Content */}
      <div className="p-4">
        {previewView === 'grid' && (
          <CustomerProductGrid
            previewProducts={previewProducts}
            previewDevice={previewDevice}
            selectedPreviewProduct={selectedPreviewProduct}
            setSelectedPreviewProduct={setSelectedPreviewProduct}
            addToPreviewCart={addToPreviewCart}
            setPreviewView={setPreviewView}
          />
        )}

        {previewView === 'detail' && selectedPreviewProduct && (
          <CustomerProductDetail
            product={selectedPreviewProduct}
            previewDevice={previewDevice}
            addToPreviewCart={addToPreviewCart}
            setPreviewView={setPreviewView}
          />
        )}

        {previewView === 'cart' && (
          <CustomerPreviewCart
            previewCart={previewCart}
            previewDevice={previewDevice}
            removeFromPreviewCart={removeFromPreviewCart}
            getPreviewCartTotal={getPreviewCartTotal}
            setPreviewView={setPreviewView}
          />
        )}
      </div>

      {/* Device Frame Indicator */}
      <div className="fixed bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded-full text-xs font-medium">
        <div className="flex items-center space-x-2">
          <ApperIcon name={previewDevice === 'mobile' ? 'Smartphone' : 'Monitor'} size={12} />
          <span>{previewDevice === 'mobile' ? 'Mobile' : 'Desktop'} Preview</span>
        </div>
      </div>
    </div>
  );
};

// Customer Product Grid Component
const CustomerProductGrid = ({
  previewProducts,
  previewDevice,
  selectedPreviewProduct,
  setSelectedPreviewProduct,
  addToPreviewCart,
  setPreviewView
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`${previewDevice === 'mobile' ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>
          Our Products
        </h2>
        <Badge variant="info" className="text-xs">
          {previewProducts.length} items
        </Badge>
      </div>

      {previewProducts.length === 0 ? (
        <div className="text-center py-12">
          <ApperIcon name="Package" size={48} className="text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products available</h3>
          <p className="text-gray-600">Add and make products visible to see them here</p>
        </div>
      ) : (
        <div className={`grid ${
          previewDevice === 'mobile' 
            ? 'grid-cols-1 gap-4' 
            : 'grid-cols-2 lg:grid-cols-3 gap-6'
        }`}>
          {previewProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-card hover:shadow-premium transition-all duration-300 overflow-hidden group cursor-pointer"
              onClick={() => {
                setSelectedPreviewProduct(product);
                setPreviewView('detail');
              }}
            >
              <div className="relative">
                <img
                  src={product.imageUrl || "/api/placeholder/300/200"}
                  alt={product.name}
                  className={`w-full ${previewDevice === 'mobile' ? 'h-48' : 'h-56'} object-cover group-hover:scale-105 transition-transform duration-300`}
                  onError={(e) => {
                    e.target.src = "/api/placeholder/300/200";
                  }}
                />
                
                {/* Product Badges */}
                {product.discountValue && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="sale" className="text-xs font-bold">
                      {product.discountType === 'Percentage' ? 
                        `${product.discountValue}% OFF` : 
                        `Rs. ${product.discountValue} OFF`}
                    </Badge>
                  </div>
                )}
                
                {product.stock <= (product.minStock || 5) && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="warning" className="text-xs">
                      Low Stock
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="space-y-2">
                  <h3 className={`${previewDevice === 'mobile' ? 'text-sm' : 'text-base'} font-semibold text-gray-900 line-clamp-2`}>
                    {product.name}
                  </h3>
                  
                  <div className="flex items-center space-x-2">
                    {product.previousPrice && (
                      <span className="text-sm text-gray-500 line-through">
                        Rs. {product.previousPrice}
                      </span>
                    )}
                    <span className={`${previewDevice === 'mobile' ? 'text-lg' : 'text-xl'} font-bold text-primary`}>
                      Rs. {product.price}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {product.category}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {product.stock} {product.unit || 'pcs'} left
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToPreviewCart(product);
                  }}
                  disabled={product.stock <= 0}
                  className={`w-full mt-4 ${
                    product.stock <= 0 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'btn-primary hover:scale-105'
                  } ${previewDevice === 'mobile' ? 'py-2 text-sm' : 'py-3'} transition-all duration-200`}
                >
                  {product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Customer Product Detail Component
const CustomerProductDetail = ({
  product,
  previewDevice,
  addToPreviewCart,
  setPreviewView
}) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          icon="ArrowLeft"
          onClick={() => setPreviewView('grid')}
          className="text-gray-600"
        >
          Back
        </Button>
        <h2 className={`${previewDevice === 'mobile' ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>
          Product Details
        </h2>
      </div>

      <div className={`${previewDevice === 'mobile' ? 'space-y-6' : 'grid grid-cols-2 gap-8'}`}>
        {/* Product Image */}
        <div className="space-y-4">
          <div className="relative">
            <img
              src={product.imageUrl || "/api/placeholder/400/400"}
              alt={product.name}
              className="w-full h-96 object-cover rounded-xl shadow-lg"
              onError={(e) => {
                e.target.src = "/api/placeholder/400/400";
              }}
            />
            
            {/* Product Badges */}
            {product.discountValue && (
              <div className="absolute top-4 left-4">
                <Badge variant="sale" className="text-sm font-bold">
                  {product.discountType === 'Percentage' ? 
                    `${product.discountValue}% OFF` : 
                    `Rs. ${product.discountValue} OFF`}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className={`${previewDevice === 'mobile' ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 mb-2`}>
              {product.name}
            </h1>
            <Badge variant="secondary" className="text-sm">
              {product.category}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              {product.previousPrice && (
                <span className="text-lg text-gray-500 line-through">
                  Rs. {product.previousPrice}
                </span>
              )}
              <span className={`${previewDevice === 'mobile' ? 'text-2xl' : 'text-3xl'} font-bold text-primary`}>
                Rs. {product.price}
              </span>
            </div>
            
            {product.discountValue && (
              <p className="text-green-600 font-medium">
                You save Rs. {(() => {
                  const discount = parseFloat(product.discountValue) || 0;
                  if (product.discountType === 'Percentage') {
                    return (product.price * discount / 100).toFixed(2);
                  }
                  return discount.toFixed(2);
                })()}
              </p>
            )}
          </div>

          {product.description && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600">{product.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Stock:</span>
              <span className="ml-2 font-medium">
                {product.stock} {product.unit || 'pcs'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Unit:</span>
              <span className="ml-2 font-medium">{product.unit || 'piece'}</span>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  <ApperIcon name="Minus" size={16} />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  disabled={quantity >= product.stock}
                >
                  <ApperIcon name="Plus" size={16} />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                for (let i = 0; i < quantity; i++) {
                  addToPreviewCart(product);
                }
                setQuantity(1);
              }}
              disabled={product.stock <= 0}
              className={`w-full ${
                product.stock <= 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'btn-primary hover:scale-105'
              } ${previewDevice === 'mobile' ? 'py-3 text-base' : 'py-4 text-lg'} transition-all duration-200`}
            >
              {product.stock <= 0 ? 'Out of Stock' : `Add ${quantity} to Cart`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Customer Preview Cart Component
const CustomerPreviewCart = ({
  previewCart,
  previewDevice,
  removeFromPreviewCart,
  getPreviewCartTotal,
  setPreviewView
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          icon="ArrowLeft"
          onClick={() => setPreviewView('grid')}
          className="text-gray-600"
        >
          Back
        </Button>
        <h2 className={`${previewDevice === 'mobile' ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>
          Shopping Cart
        </h2>
      </div>

      {previewCart.length === 0 ? (
        <div className="text-center py-12">
          <ApperIcon name="ShoppingCart" size={48} className="text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-gray-600 mb-4">Add some products to see them here</p>
          <Button
            variant="primary"
            onClick={() => setPreviewView('grid')}
          >
            Continue Shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {previewCart.map((item) => (
              <div
                key={`${item.id}-${Date.now()}`}
                className="bg-white rounded-lg p-4 shadow-sm border"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={item.imageUrl || "/api/placeholder/80/80"}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    onError={(e) => {
                      e.target.src = "/api/placeholder/80/80";
                    }}
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.category}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-medium text-primary">Rs. {item.price}</span>
                      <span className="text-sm text-gray-500">× {item.quantity}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      Rs. {(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromPreviewCart(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">
                  Rs. {getPreviewCartTotal().toFixed(2)}
                </span>
              </div>
              
              <div className="space-y-3">
                <button className="w-full btn-primary py-3">
                  Proceed to Checkout
                </button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewView('grid')}
                  className="w-full"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin Products Table Component
const AdminProductsTable = ({
  products,
  filteredProducts,
  categories,
  pendingVisibilityToggles,
  handleEdit,
  handleDelete,
  handleVisibilityToggle
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Products ({filteredProducts.length})
          </h3>
          <div className="flex items-center space-x-2">
            <Badge variant="primary">
              Total: {products.length}
            </Badge>
            <Badge variant="secondary">
              Low Stock: {products.filter(p => p && p.stock <= (p.minStock || 5)).length}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6">
        {filteredProducts.length === 0 ? (
          <Empty 
            title="No products found"
            description="Try adjusting your search or filter criteria"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`hover:bg-gray-50 transition-opacity duration-200 ${
                      product.isVisible === false ? 'opacity-60' : 'opacity-100'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={product.imageUrl || "/api/placeholder/40/40"}
                            alt={product.name || "Product"}
                            onError={(e) => {
                              e.target.src = "/api/placeholder/40/40";
                            }}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name || "Unnamed Product"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {product.barcode || "No barcode"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="secondary">
                        {product.category || "No Category"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Rs. {product.price || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <Badge 
                        variant={product.stock <= (product.minStock || 5) ? "error" : "success"}
                      >
                        {product.stock || 0} {product.unit || "pcs"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={product.isVisible !== false}
                            onChange={() => handleVisibilityToggle(product.id, product.isVisible !== false)}
                            color="primary"
                            disabled={pendingVisibilityToggles.has(product.id)}
                          />
                          <span className={`text-sm font-medium ${
                            product.isVisible === false ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            {product.isVisible === false ? 'Hidden' : 'Visible'}
                          </span>
                          {pendingVisibilityToggles.has(product.id) && (
                            <div className="ml-2">
                              <ApperIcon name="Loader2" size={14} className="animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="Edit"
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="Trash2"
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
</div>
  );
};


// Product Form Modal Component (extracted for reuse)
const ProductFormModal = ({
  editingProduct,
  formData,
  setFormData,
  imageData,
  setImageData,
  categories,
  units,
  handleInputChange,
  handleImageUpload,
  handleImageSearch,
  handleAIImageGenerate,
  handleImageSelect,
  handleSubmit,
  resetForm
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ApperIcon name="X" size={24} />
            </button>
          </div>
</div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Product Name *"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              icon="Package"
              placeholder="Enter product name"
            />
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="input-field"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Price (Rs.) *"
              name="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={handleInputChange}
              required
              icon="DollarSign"
              placeholder="0.00"
            />
            <Input
              label="Cost Price (Rs.)"
              name="purchasePrice"
              type="number"
              step="0.01"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              icon="ShoppingCart"
              placeholder="0.00"
            />
          </div>

          {/* Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Stock Quantity *"
              name="stock"
              type="number"
              value={formData.stock}
              onChange={handleInputChange}
              required
              icon="Archive"
              placeholder="0"
            />
            <Input
              label="Low Stock Alert"
              name="minStock"
              type="number"
              value={formData.minStock}
              onChange={handleInputChange}
              placeholder="5"
              icon="AlertTriangle"
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Unit *
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                className="input-field"
                required
              >
                <option value="">Select Unit</option>
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <Input
            label="Product Description"
            name="description"
            type="textarea"
            placeholder="Detailed product description..."
            value={formData.description}
            onChange={handleInputChange}
            icon="FileText"
          />

{/* Image Upload System */}
          <ImageUploadSystem
            imageData={imageData}
            setImageData={setImageData}
            onImageUpload={handleImageUpload}
            onImageSearch={handleImageSearch}
            onAIImageGenerate={handleAIImageGenerate}
            onImageSelect={handleImageSelect}
            formData={formData}
          />

<div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              icon="Save"
              onClick={handleSubmit}
            >
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;