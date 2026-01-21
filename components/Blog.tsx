import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublishedPosts, getPostBySlug, BlogPost as BlogPostType } from '../data/blogPosts';
import {
  GraduationCap,
  ArrowLeft,
  Clock,
  Calendar,
  Tag,
  ArrowRight,
  Sun,
  Moon,
  BookOpen
} from 'lucide-react';

// Blog listing page
export const BlogList: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const posts = getPublishedPosts();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studystack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studystack_theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] transition-colors">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">StudyStack</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              {darkMode ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <Link
              to="/"
              className="bg-[#2563eb] text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-sm"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="px-6 py-16 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-bold mb-6">
          <BookOpen className="w-4 h-4" />
          StudyStack Blog
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Study Smarter, Not Harder
        </h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Evidence-based study tips, learning science, and productivity strategies to help you ace your exams.
        </p>
      </header>

      {/* Posts Grid */}
      <main className="px-6 pb-20 max-w-4xl mx-auto">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post, index) => (
              <article
                key={post.slug}
                className={`bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
                  index === 0 ? 'md:flex' : ''
                }`}
              >
                <div className={`p-8 ${index === 0 ? 'md:flex-1' : ''}`}>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                      {post.category}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                      <Clock className="w-4 h-4" />
                      {post.readTime} min read
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      {new Date(post.publishDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>

                  <Link to={`/blog/${post.slug}`}>
                    <h2 className={`font-bold text-slate-900 dark:text-white mb-3 hover:text-[#2563eb] dark:hover:text-blue-400 transition-colors ${
                      index === 0 ? 'text-2xl' : 'text-xl'
                    }`}>
                      {post.title}
                    </h2>
                  </Link>

                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    {post.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-[#2563eb] dark:text-blue-400 font-bold hover:gap-3 transition-all"
                  >
                    Read More
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* CTA */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Ready to Study Smarter?</h2>
          <p className="text-blue-100 mb-6">Turn your PDFs into flashcards, quizzes, and summaries in seconds.</p>
          <Link
            to="/"
            className="inline-block bg-white text-[#2563eb] px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-[#1e293b] px-6 py-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">StudyStack</span>
          </div>
          <div className="flex gap-6 text-slate-600 dark:text-slate-400 text-sm">
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <Link to="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} StudyStack</p>
        </div>
      </footer>
    </div>
  );
};

interface BlogPostViewProps {
  slug: string;
}

// Individual blog post page
export const BlogPostView: React.FC<BlogPostViewProps> = ({ slug }) => {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const post = getPostBySlug(slug);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studystack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studystack_theme', 'light');
    }
  }, [darkMode]);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Post Not Found</h1>
          <Link to="/blog" className="text-[#2563eb] font-bold hover:underline">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  // Simple markdown-ish rendering
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (currentList.length > 0) {
        const ListTag = listType === 'ol' ? 'ol' : 'ul';
        elements.push(
          <ListTag key={elements.length} className={`mb-4 ml-6 text-slate-700 dark:text-slate-300 ${listType === 'ol' ? 'list-decimal' : 'list-disc'}`}>
            {currentList.map((item, i) => (
              <li key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: formatInlineStyles(item) }} />
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    const formatInlineStyles = (text: string): string => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Headers
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-2xl font-bold text-slate-900 dark:text-white mt-8 mb-4">
            {trimmedLine.slice(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-3">
            {trimmedLine.slice(4)}
          </h3>
        );
      }
      // Unordered list
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        currentList.push(trimmedLine.slice(2));
      }
      // Ordered list
      else if (/^\d+\.\s/.test(trimmedLine)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentList.push(trimmedLine.replace(/^\d+\.\s/, ''));
      }
      // Empty line
      else if (trimmedLine === '') {
        flushList();
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(
          <p
            key={index}
            className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatInlineStyles(trimmedLine) }}
          />
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] transition-colors">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">StudyStack</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              {darkMode ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <Link
              to="/"
              className="bg-[#2563eb] text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-sm"
            >
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Back link */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
      </div>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 py-8">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
            {post.category}
          </span>
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <Clock className="w-4 h-4" />
            {post.readTime} min read
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <Calendar className="w-4 h-4" />
            {new Date(post.publishDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
          {post.title}
        </h1>

        {/* Description */}
        <p className="text-xl text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          {post.description}
        </p>

        {/* Content */}
        <div className="prose-custom">
          {renderContent(post.content)}
        </div>

        {/* Tags */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* CTA */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Ready to Study Smarter?</h2>
          <p className="text-blue-100 mb-6">Turn your PDFs into flashcards, quizzes, and summaries in seconds.</p>
          <Link
            to="/"
            className="inline-block bg-white text-[#2563eb] px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-[#1e293b] px-6 py-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">StudyStack</span>
          </div>
          <div className="flex gap-6 text-slate-600 dark:text-slate-400 text-sm">
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            <Link to="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} StudyStack</p>
        </div>
      </footer>
    </div>
  );
};
