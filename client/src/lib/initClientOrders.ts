import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ClientOrder } from './firebaseService';

export const initializeClientOrders = async () => {
  try {
    console.log("Initializing client orders collection with sample data...");
    
    const sampleOrders: Omit<ClientOrder, 'id' | 'createdAt' | 'updatedAt' | 'selected'>[] = [
      {
        orderNumber: 'ORD-2025-001',
        clientName: 'Fresh Markets International',
        clientEmail: 'procurement@freshmarkets.com',
        clientPhone: '+1 (555) 123-4567',
        products: [
          {
            id: 'prod1',
            name: 'Premium Hass Avocados',
            quantity: 500,
            unit: 'kg',
            pricePerUnit: 3.50,
            totalPrice: 1750.00
          },
          {
            id: 'prod2',
            name: 'Organic Green Avocados',
            quantity: 300,
            unit: 'kg',
            pricePerUnit: 4.00,
            totalPrice: 1200.00
          }
        ],
        status: 'processing',
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        requestedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 2950.00,
        priority: 'high',
        notes: 'Rush order - client has urgent requirement for weekend farmers market',
        shippingAddress: {
          street: '123 Market Street',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'USA'
        },
        paymentStatus: 'paid'
      },
      {
        orderNumber: 'ORD-2025-002',
        clientName: 'Gourmet Foods Co.',
        clientEmail: 'orders@gourmetfoods.com',
        clientPhone: '+1 (555) 987-6543',
        products: [
          {
            id: 'prod3',
            name: 'Premium Hass Avocados',
            quantity: 1000,
            unit: 'kg',
            pricePerUnit: 3.50,
            totalPrice: 3500.00
          },
          {
            id: 'prod4',
            name: 'Organic Limes',
            quantity: 200,
            unit: 'kg',
            pricePerUnit: 2.50,
            totalPrice: 500.00
          },
          {
            id: 'prod5',
            name: 'Baby Mangoes',
            quantity: 150,
            unit: 'kg',
            pricePerUnit: 5.00,
            totalPrice: 750.00
          }
        ],
        status: 'shipped',
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        requestedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 4750.00,
        priority: 'medium',
        notes: 'Regular monthly order - standard packaging required',
        shippingAddress: {
          street: '456 Commerce Blvd',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          country: 'USA'
        },
        paymentStatus: 'paid'
      },
      {
        orderNumber: 'ORD-2025-003',
        clientName: 'Healthy Choice Supermarkets',
        clientEmail: 'supply@healthychoice.com',
        clientPhone: '+1 (555) 456-7890',
        products: [
          {
            id: 'prod6',
            name: 'Organic Green Avocados',
            quantity: 750,
            unit: 'kg',
            pricePerUnit: 4.00,
            totalPrice: 3000.00
          }
        ],
        status: 'pending',
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        requestedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 3000.00,
        priority: 'low',
        notes: 'Standard delivery window is acceptable',
        shippingAddress: {
          street: '789 Health Avenue',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          country: 'USA'
        },
        paymentStatus: 'pending'
      },
      {
        orderNumber: 'ORD-2025-004',
        clientName: 'Metro Restaurant Group',
        clientEmail: 'purchasing@metrorestaurants.com',
        clientPhone: '+1 (555) 321-9876',
        products: [
          {
            id: 'prod7',
            name: 'Premium Hass Avocados',
            quantity: 200,
            unit: 'kg',
            pricePerUnit: 3.50,
            totalPrice: 700.00
          },
          {
            id: 'prod8',
            name: 'Cherry Tomatoes',
            quantity: 100,
            unit: 'kg',
            pricePerUnit: 6.00,
            totalPrice: 600.00
          },
          {
            id: 'prod9',
            name: 'Fresh Herbs Mix',
            quantity: 50,
            unit: 'kg',
            pricePerUnit: 8.00,
            totalPrice: 400.00
          }
        ],
        status: 'delivered',
        orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        requestedDeliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        actualDeliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 1700.00,
        priority: 'high',
        notes: 'Multiple restaurant locations - split delivery required',
        shippingAddress: {
          street: '321 Culinary Square',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          country: 'USA'
        },
        paymentStatus: 'paid'
      },
      {
        orderNumber: 'ORD-2025-005',
        clientName: 'Organic Valley Distribution',
        clientEmail: 'orders@organicvalley.com',
        clientPhone: '+1 (555) 654-3210',
        products: [
          {
            id: 'prod10',
            name: 'Organic Green Avocados',
            quantity: 2000,
            unit: 'kg',
            pricePerUnit: 4.00,
            totalPrice: 8000.00
          },
          {
            id: 'prod11',
            name: 'Organic Papayas',
            quantity: 500,
            unit: 'kg',
            pricePerUnit: 3.75,
            totalPrice: 1875.00
          }
        ],
        status: 'cancelled',
        orderDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        requestedDeliveryDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 9875.00,
        priority: 'medium',
        notes: 'Order cancelled due to quality issues detected during inspection',
        shippingAddress: {
          street: '567 Distribution Center Way',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          country: 'USA'
        },
        paymentStatus: 'refunded'
      },
      {
        orderNumber: 'ORD-2025-006',
        clientName: 'Farm to Table Restaurants',
        clientEmail: 'chef@farmtotable.com',
        clientPhone: '+1 (555) 888-9999',
        products: [
          {
            id: 'prod12',
            name: 'Premium Hass Avocados',
            quantity: 300,
            unit: 'kg',
            pricePerUnit: 3.50,
            totalPrice: 1050.00
          },
          {
            id: 'prod13',
            name: 'Heirloom Tomatoes',
            quantity: 150,
            unit: 'kg',
            pricePerUnit: 7.50,
            totalPrice: 1125.00
          }
        ],
        status: 'processing',
        orderDate: new Date().toISOString(),
        requestedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmount: 2175.00,
        priority: 'medium',
        notes: 'Weekly delivery for farm-to-table restaurant chain',
        shippingAddress: {
          street: '890 Chef Boulevard',
          city: 'Austin',
          state: 'TX',
          zipCode: '73301',
          country: 'USA'
        },
        paymentStatus: 'pending'
      }
    ];

    const ordersRef = collection(db, 'client-orders');
    
    for (const orderData of sampleOrders) {
      const docRef = await addDoc(ordersRef, {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log(`Created order: ${orderData.orderNumber} with ID: ${docRef.id}`);
    }
    
    console.log("Successfully initialized client orders collection!");
    return true;
  } catch (error) {
    console.error("Error initializing client orders:", error);
    throw error;
  }
};
