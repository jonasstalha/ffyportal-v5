import React, { useState, useEffect } from 'react';
import { MessageCircle, Bell, Search, Filter, Send, Users, Loader2, Database, CheckSquare } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { 
  getAllMessages, 
  getMessagesForUser, 
  sendMessage, 
  markMessageAsRead, 
  deleteMessageFromDB,
  getCommunicationNotifications,
  addCommunicationNotification,
  markCommunicationNotificationAsRead,
  deleteCommunicationNotification,
  getUsers,
  type Message as FirebaseMessage,
  type CommunicationNotification
} from '@/lib/firebaseService';
import { initializeCommunication } from '@/lib/initCommunication';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  recipientEmail?: string;
  recipientName?: string;
}

interface Notification {
  id: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

interface User {
  email: string;
  name: string;
}

export default function CommunicationDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('messages');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Convert Firebase message to local message format
  const convertFirebaseMessage = (fbMessage: FirebaseMessage): Message => ({
    id: fbMessage.id,
    sender: fbMessage.senderName,
    content: fbMessage.content,
    timestamp: new Date(fbMessage.timestamp),
    read: fbMessage.read,
    priority: fbMessage.priority,
    recipientEmail: fbMessage.recipientEmail,
    recipientName: fbMessage.recipientName
  });

  // Convert Firebase notification to local notification format
  const convertFirebaseNotification = (fbNotification: CommunicationNotification): Notification => ({
    id: fbNotification.id,
    content: fbNotification.content,
    timestamp: new Date(fbNotification.timestamp),
    read: fbNotification.read
  });

  // Set up real-time listeners
  useEffect(() => {
    if (!user?.email) return;

    setLoading(true);

    // Listen for messages
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList: Message[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only show messages that are either broadcasts or addressed to this user
        if (!data.recipientEmail || data.recipientEmail === user.email) {
          messagesList.push({
            id: doc.id,
            sender: data.senderName || data.senderEmail,
            content: data.content,
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read || false,
            priority: data.priority || 'medium',
            recipientEmail: data.recipientEmail,
            recipientName: data.recipientName
          });
        }
      });
      setMessages(messagesList);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to messages:', error);
      setMessages([]); // Set empty array as fallback
      setLoading(false);
    });

    // Listen for notifications
    const notificationsRef = collection(db, 'communication-notifications');
    const notificationsQuery = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsList: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        notificationsList.push({
          id: doc.id,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false
        });
      });
      setNotifications(notificationsList);
    }, (error) => {
      console.error('Error listening to notifications:', error);
      setNotifications([]); // Set empty array as fallback
    });

    // Load users for message addressing
    const loadUsers = async () => {
      try {
        const usersList = await getUsers();
        setUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
        // Create a fallback user list if users collection is not accessible
        setUsers([
          {
            name: 'Administrateur',
            email: 'admin@fruitsforyou.com'
          },
          {
            name: 'Responsable Qualité',
            email: 'qualite@fruitsforyou.com'
          },
          {
            name: 'Responsable Production',
            email: 'production@fruitsforyou.com'
          }
        ]);
      }
    };
    
    loadUsers();

    return () => {
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, [user?.email]);

  const getTabClassName = (tabName: string) => {
    return activeTab === tabName
      ? 'px-6 py-3 border-b-2 border-blue-500 text-blue-600'
      : 'px-6 py-3 text-gray-500 hover:text-gray-700';
  };

  const getMessageClassName = (message: Message) => {
    const baseClass = 'p-4 rounded-lg border';
    const readClass = message.read ? 'bg-white' : 'bg-blue-50';
    const priorityClass = 
      message.priority === 'high' ? 'border-red-200' :
      message.priority === 'medium' ? 'border-yellow-200' :
      'border-gray-200';
    
    return [baseClass, readClass, priorityClass].join(' ');
  };

  // Filtered and searched messages
  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      !searchTerm ||
      message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.sender.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority =
      filterPriority === 'all' || message.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  // Mark notification as read
  const markNotificationRead = async (id: string) => {
    try {
      await markCommunicationNotificationAsRead(id);
      toast.success('Notification marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark message as read
  const markMessageRead = async (id: string) => {
    try {
      await markMessageAsRead(id);
      toast.success('Message marked as read');
    } catch (error) {
      console.error('Error marking message as read:', error);
      toast.error('Failed to mark message as read');
    }
  };

  // Send message
  const handleSendMessage = async (content: string, priority: 'high' | 'medium' | 'low', recipientEmail?: string) => {
    if (!user?.email || !content.trim()) return;
    
    setSending(true);
    try {
      const recipientUser = users.find(u => u.email === recipientEmail);
      await sendMessage({
        senderEmail: user.email,
        senderName: user.displayName || user.email,
        recipientEmail: recipientEmail || undefined,
        recipientName: recipientUser?.name || undefined,
        content: content.trim(),
        priority
      });
      
      toast.success(recipientEmail ? `Message sent to ${recipientUser?.name || recipientEmail}` : 'Broadcast message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Add message (using handleSendMessage)
  const addMessage = (sender: string, content: string, priority: 'high' | 'medium' | 'low') => {
    handleSendMessage(content, priority, selectedRecipient || undefined);
  };

  // Delete message
  const deleteMessage = async (id: string) => {
    try {
      await deleteMessageFromDB(id);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  // Initialize communication collections
  const handleInitializeCommunication = async () => {
    try {
      await initializeCommunication();
      toast.success('Communication système initialisé avec succès!');
      // Refresh the page to reload data
      window.location.reload();
    } catch (error) {
      console.error('Error initializing communication:', error);
      toast.error('Erreur lors de l\'initialisation');
    }
  };

  // Add notification
  const addNotification = async (content: string) => {
    try {
      await addCommunicationNotification(content);
      toast.success('Notification added');
    } catch (error) {
      console.error('Error adding notification:', error);
      toast.error('Failed to add notification');
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      await deleteCommunicationNotification(id);
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Communication Dashboard</h1>
            <p className="text-gray-600">Manage all your team communications in one place</p>
            {user && (
              <p className="text-sm text-gray-500 mt-1">Logged in as: {user.displayName || user.email}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInitializeCommunication}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Database className="h-4 w-4 mr-2" />
              Initialize System
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading messages...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Search and Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative w-full md:w-48">
                <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <select
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={getTabClassName('messages')}
                onClick={() => setActiveTab('messages')}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Messages</span>
                  {messages.filter(m => !m.read).length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {messages.filter(m => !m.read).length}
                    </span>
                  )}
                </div>
              </button>
              <button
                className={getTabClassName('notifications')}
                onClick={() => setActiveTab('notifications')}
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <span>Notifications</span>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {activeTab === 'messages' && (
                <>
                  <form
                    className="mb-6 p-4 bg-gray-50 rounded-lg"
                    onSubmit={e => {
                      e.preventDefault();
                      const form = e.target as typeof e.target & { 
                        content: { value: string }, 
                        priority: { value: string } 
                      };
                      if (form.content.value.trim()) {
                        addMessage('You', form.content.value, form.priority.value as any);
                        form.content.value = '';
                        setSelectedRecipient('');
                      }
                    }}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col md:flex-row gap-2">
                        <div className="relative flex-1">
                          <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <select 
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={selectedRecipient}
                            onChange={(e) => setSelectedRecipient(e.target.value)}
                          >
                            <option value="">Broadcast to all</option>
                            {users.map(user => (
                              <option key={user.email} value={user.email}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        <select name="priority" className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          name="content" 
                          placeholder="Type your message..." 
                          className="border border-gray-300 rounded-lg px-3 py-2 flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          required 
                        />
                        <button 
                          type="submit" 
                          disabled={sending}
                          className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send
                        </button>
                      </div>
                    </div>
                  </form>
                  
                  <div className="space-y-4">
                    {filteredMessages.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No messages found.</p>
                      </div>
                    )}
                    {filteredMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`${getMessageClassName(message)} cursor-pointer transition-all duration-200 hover:shadow-md`}
                        onClick={() => !message.read && markMessageRead(message.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            {/* Custom Checkbox */}
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                message.read 
                                  ? 'bg-green-500 border-green-500 text-white' 
                                  : 'border-gray-300 hover:border-blue-500 bg-white'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!message.read) {
                                  markMessageRead(message.id);
                                }
                              }}
                            >
                              {message.read && <CheckSquare className="h-3 w-3" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{message.sender}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  message.priority === 'high' ? 'bg-red-100 text-red-800' :
                                  message.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {message.priority.toUpperCase()}
                                </span>
                              </div>
                              {message.recipientEmail && (
                                <p className="text-xs text-gray-500 mb-1">
                                  To: {message.recipientName || message.recipientEmail}
                                </p>
                              )}
                              {!message.recipientEmail && (
                                <p className="text-xs text-blue-600 mb-1 font-medium">📢 Broadcast message</p>
                              )}
                              <p className="text-gray-600 text-sm leading-relaxed">{message.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {message.timestamp.toLocaleString()}
                            </span>
                            {!message.read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {!message.read && (
                              <button
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  markMessageRead(message.id); 
                                }}
                              >
                                Mark as Read
                              </button>
                            )}
                            {message.read && (
                              <span className="text-xs text-green-600 font-medium">✓ Read</span>
                            )}
                          </div>
                          <button
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            onClick={e => { 
                              e.stopPropagation(); 
                              if (confirm('Are you sure you want to delete this message?')) {
                                deleteMessage(message.id); 
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'notifications' && (
                <>
                  <form
                    className="flex flex-col md:flex-row gap-2 mb-4"
                    onSubmit={e => {
                      e.preventDefault();
                      const form = e.target as typeof e.target & { content: { value: string } };
                      if (form.content.value.trim()) {
                        addNotification(form.content.value);
                        form.content.value = '';
                      }
                    }}
                  >
                    <input 
                      name="content" 
                      placeholder="Add notification..." 
                      className="border border-gray-300 rounded-lg px-3 py-2 flex-1 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" 
                      required 
                    />
                    <button 
                      type="submit" 
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </form>
                  
                  <div className="space-y-4">
                    {notifications.length === 0 && (
                      <div className="text-center text-gray-400 py-8">
                        <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No notifications.</p>
                      </div>
                    )}
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer ${
                          notification.read 
                            ? 'bg-white border-gray-200' 
                            : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                        }`}
                        onClick={() => !notification.read && markNotificationRead(notification.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            {/* Custom Checkbox for Notifications */}
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                notification.read 
                                  ? 'bg-yellow-500 border-yellow-500 text-white' 
                                  : 'border-gray-300 hover:border-yellow-500 bg-white'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!notification.read) {
                                  markNotificationRead(notification.id);
                                }
                              }}
                            >
                              {notification.read && <CheckSquare className="h-3 w-3" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-gray-900 font-medium">📋 System Notification</span>
                                {!notification.read && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm leading-relaxed">{notification.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {notification.timestamp.toLocaleString()}
                            </span>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <button
                                className="text-xs text-yellow-600 hover:text-yellow-800 font-medium transition-colors"
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  markNotificationRead(notification.id); 
                                }}
                              >
                                Mark as Read
                              </button>
                            )}
                            {notification.read && (
                              <span className="text-xs text-yellow-600 font-medium">✓ Read</span>
                            )}
                          </div>
                          <button
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            onClick={e => { 
                              e.stopPropagation(); 
                              if (confirm('Are you sure you want to delete this notification?')) {
                                deleteNotification(notification.id); 
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
