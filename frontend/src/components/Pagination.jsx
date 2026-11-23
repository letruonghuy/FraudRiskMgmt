import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  page,
  totalPages,
  totalCount,
  itemLabel = 'bản ghi',
  onPageChange,
  disabled = false,
  style,
  ariaLabel = 'Phân trang',
}) {
  const [inputValue, setInputValue] = useState(String(page));

  useEffect(() => {
    setInputValue(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  const commitPage = () => {
    const parsed = parseInt(inputValue, 10);
    if (!Number.isFinite(parsed)) {
      setInputValue(String(page));
      return;
    }
    const target = Math.min(Math.max(1, parsed), totalPages);
    setInputValue(String(target));
    if (target !== page && !disabled) {
      onPageChange(target);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitPage();
    } else if (event.key === 'Escape') {
      setInputValue(String(page));
    }
  };

  const handleChange = (event) => {
    // Chỉ cho phép nhập ký tự số
    const digitsOnly = event.target.value.replace(/\D/g, '');
    setInputValue(digitsOnly);
  };

  return (
    <nav className="pagination" style={style} aria-label={ariaLabel}>
      <span className="page-info">
        Trang {page} / {totalPages} · {Number(totalCount || 0).toLocaleString('vi-VN')} {itemLabel}
      </span>

      <div className="page-controls">
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || disabled}
          aria-label="Trang đầu"
          title="Trang đầu"
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || disabled}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <label className="page-jump">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="page-input"
            aria-label="Nhập số trang muốn chuyển tới"
            value={inputValue}
            disabled={disabled}
            onChange={handleChange}
            onBlur={commitPage}
            onKeyDown={handleKeyDown}
            onFocus={(event) => event.target.select()}
          />
          <span>/ {totalPages}</span>
        </label>

        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || disabled}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || disabled}
          aria-label="Trang cuối"
          title="Trang cuối"
        >
          <ChevronsRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}