import React, { useState, type FC } from 'react';
import { Modal } from './Modal';

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  ia?: string[]; // Internet Archive IDs (indicates free availability)
  has_fulltext?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pdfUrl: string, title: string) => void;
}

export const BookSearchModal: FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchedByISBN, setSearchedByISBN] = useState(false);

  const searchBooks = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      // Check if query looks like ISBN (10 or 13 digits after removing non-digits)
      const cleanedQuery = query.replace(/[^\d]/g, '');
      const isISBN = cleanedQuery.length === 10 || cleanedQuery.length === 13;
      setSearchedByISBN(isISBN);

      let url: string;
      if (isISBN) {
        // ISBN search - don't filter by has_fulltext, show all results
        url = `https://openlibrary.org/search.json?isbn=${cleanedQuery}&limit=10`;
      } else {
        url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&has_fulltext=true`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (isISBN) {
        // For ISBN search, show all results (mark which are free)
        setResults(data.docs || []);
      } else {
        // For title search, filter to only free books
        const booksWithFullText = (data.docs || []).filter((book: BookResult) =>
          book.ia && book.ia.length > 0
        );
        setResults(booksWithFullText);
      }
    } catch (e) {
      console.error('Search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (book: BookResult) => {
    if (book.ia && book.ia.length > 0) {
      // Link to Internet Archive reader (legal free access)
      const iaId = book.ia[0];
      const readUrl = `https://archive.org/details/${iaId}`;
      onSelect(readUrl, book.title);
    } else {
      // Link to Open Library page for more info
      const olUrl = `https://openlibrary.org${book.key}`;
      onSelect(olUrl, book.title);
    }
  };

  const isFreeBook = (book: BookResult) => book.ia && book.ia.length > 0;

  const getCoverUrl = (coverId?: number) => {
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Free Textbooks" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
            placeholder="Search by title, author, or ISBN..."
            className="flex-1 p-3 border border-slate-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-blue-100 outline-none"
          />
          <button
            onClick={searchBooks}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search"></i>}
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Searches Open Library for legally free books. Results link to Internet Archive.
        </p>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto space-y-3">
          {loading && (
            <div className="text-center py-8 text-slate-400">
              <i className="fas fa-circle-notch fa-spin text-2xl mb-2"></i>
              <p>Searching...</p>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <i className="fas fa-book text-3xl mb-2 text-slate-300"></i>
              <p className="font-medium">No free books found</p>
              <p className="text-sm mt-1">Try a different search term or check OpenStax.org for textbooks</p>
            </div>
          )}

          {results.map((book) => (
            <div
              key={book.key}
              className="flex gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              onClick={() => handleSelect(book)}
            >
              {/* Cover */}
              <div className="flex-shrink-0 w-16 h-20 bg-slate-200 rounded overflow-hidden">
                {getCoverUrl(book.cover_i) ? (
                  <img
                    src={getCoverUrl(book.cover_i)!}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <i className="fas fa-book text-xl"></i>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 line-clamp-2">{book.title}</h4>
                {book.author_name && (
                  <p className="text-sm text-slate-500 mt-1">
                    {book.author_name.slice(0, 2).join(', ')}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {book.first_publish_year && (
                    <span className="text-slate-400">{book.first_publish_year}</span>
                  )}
                  {isFreeBook(book) ? (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      <i className="fas fa-check mr-1"></i>Free
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                      <i className="fas fa-info-circle mr-1"></i>View Info
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="flex-shrink-0 flex items-center">
                <i className="fas fa-external-link-alt text-slate-400"></i>
              </div>
            </div>
          ))}
        </div>

        {/* External Links */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-bold mb-2">Other Free Textbook Sources:</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://openstax.org/subjects"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              <i className="fas fa-external-link-alt mr-1"></i> OpenStax
            </a>
            <a
              href="https://www.gutenberg.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              <i className="fas fa-external-link-alt mr-1"></i> Project Gutenberg
            </a>
            <a
              href="https://libretexts.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              <i className="fas fa-external-link-alt mr-1"></i> LibreTexts
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
};
