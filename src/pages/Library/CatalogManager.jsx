import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Book, Bookmark } from 'lucide-react';

const CatalogManager = () => {
  const [activeTab, setActiveTab] = useState('books'); // 'books', 'categories', 'copies'
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', isbn: '', category_id: '' });
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always fetch categories so the dropdown has data
      const { data: catData, error: catError } = await supabase
        .from('lib_categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (!catError && catData) setCategories(catData);

      if (activeTab === 'books') {
        const { data, error } = await supabase
          .from('lib_books')
          .select('*, lib_categories(name)')
          .order('created_at', { ascending: false });
        if (!error && data) setBooks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!newBook.title) return alert('Title is required');
    
    setIsSubmitting(true);
    try {
      const { data: bookData, error } = await supabase
        .from('lib_books')
        .insert([{ 
          title: newBook.title, 
          isbn: newBook.isbn || null, 
          category_id: newBook.category_id || null 
        }])
        .select();
        
      if (error) throw error;
      
      const newBookId = bookData[0].id;
      const accessionNumber = `ACC-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Auto-create 1 physical copy for circulation
      await supabase.from('lib_book_copies').insert([{
        book_id: newBookId,
        accession_number: accessionNumber,
        barcode: accessionNumber // use same for barcode for easy testing
      }]);

      alert(`Book added successfully! Generated Accession/Barcode: ${accessionNumber}`);
      setShowAddBookModal(false);
      setNewBook({ title: '', isbn: '', category_id: '' });
      fetchData(); // Refresh list
    } catch (err) {
      alert('Error adding book: ' + err.message);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name) return alert('Category Name is required');
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('lib_categories')
        .insert([{ 
          name: newCategory.name, 
          description: newCategory.description || null
        }])
        .select();
        
      if (error) throw error;
      
      alert('Category added successfully!');
      setShowAddCategoryModal(false);
      setNewCategory({ name: '', description: '' });
      fetchData(); // Refresh list
    } catch (err) {
      alert('Error adding category: ' + err.message);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Catalog Manager</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('books')}
            style={{ 
              padding: '0.5rem 1rem', 
              border: 'none', 
              borderRadius: '0.375rem', 
              background: activeTab === 'books' ? 'white' : 'transparent',
              color: activeTab === 'books' ? '#0f172a' : '#64748b',
              fontWeight: 600,
              boxShadow: activeTab === 'books' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer'
            }}
          >
            Books
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            style={{ 
              padding: '0.5rem 1rem', 
              border: 'none', 
              borderRadius: '0.375rem', 
              background: activeTab === 'categories' ? 'white' : 'transparent',
              color: activeTab === 'categories' ? '#0f172a' : '#64748b',
              fontWeight: 600,
              boxShadow: activeTab === 'categories' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer'
            }}
          >
            Categories
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : activeTab === 'books' ? (
        <div>
          <button 
            onClick={() => setShowAddBookModal(true)}
            style={{ marginBottom: '1rem', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <Plus size={18} /> Add New Book
          </button>
          
          {showAddBookModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>Add New Book</h3>
                <form onSubmit={handleAddBook} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Title *</label>
                    <input 
                      type="text" 
                      required
                      value={newBook.title}
                      onChange={e => setNewBook({...newBook, title: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                      placeholder="Enter book title"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>ISBN</label>
                    <input 
                      type="text" 
                      value={newBook.isbn}
                      onChange={e => setNewBook({...newBook, isbn: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                      placeholder="e.g. 978-0132350884"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Category</label>
                    <select 
                      value={newBook.category_id}
                      onChange={e => setNewBook({...newBook, category_id: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                    >
                      <option value="">Select a category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button 
                      type="button"
                      onClick={() => setShowAddBookModal(false)}
                      style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      style={{ flex: 1, padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                      {isSubmitting ? 'Adding...' : 'Save Book'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {books.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
              <Book size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: '#64748b' }}>No books in the catalog yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '1rem 0' }}>Title</th>
                    <th style={{ padding: '1rem 0' }}>ISBN</th>
                    <th style={{ padding: '1rem 0' }}>Category</th>
                    <th style={{ padding: '1rem 0' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map(book => (
                    <tr key={book.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem 0', fontWeight: 600 }}>{book.title}</td>
                      <td style={{ padding: '1rem 0', color: '#64748b' }}>{book.isbn || 'N/A'}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span style={{ background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem' }}>
                          {book.lib_categories?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={{ padding: '0.5rem', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}><Edit2 size={16} /></button>
                          <button style={{ padding: '0.5rem', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Categories View */}
          <button 
            onClick={() => setShowAddCategoryModal(true)}
            style={{ marginBottom: '1rem', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <Plus size={18} /> Add Category
          </button>
          
          {showAddCategoryModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>Add New Category</h3>
                <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Category Name *</label>
                    <input 
                      type="text" 
                      required
                      value={newCategory.name}
                      onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                      placeholder="e.g. Science Fiction"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Description</label>
                    <textarea 
                      value={newCategory.description}
                      onChange={e => setNewCategory({...newCategory, description: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', minHeight: '80px' }}
                      placeholder="Short description of this category..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button 
                      type="button"
                      onClick={() => setShowAddCategoryModal(false)}
                      style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      style={{ flex: 1, padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                    >
                      {isSubmitting ? 'Adding...' : 'Save Category'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', color: '#64748b' }}>
                  <Bookmark size={24} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{cat.name}</h4>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>{cat.description}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ fontSize: '0.875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                    <button style={{ fontSize: '0.875rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogManager;
