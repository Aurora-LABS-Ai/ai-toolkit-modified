import Loading from './Loading';
import classNames from 'classnames';

export interface TableColumn {
  title: string;
  key: string;
  render?: (row: any) => React.ReactNode;
  className?: string;
}

interface TableRow {
  [key: string]: any;
}

interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  isLoading: boolean;
  theadClassName?: string;
  className?: string;
  onRefresh: () => void;
}

export default function UniversalTable({
  columns,
  rows,
  isLoading,
  theadClassName = 'text-gray-400',
  className,
  onRefresh = () => {},
}: TableProps) {
  return (
    <div className={classNames('w-full rounded-xl overflow-hidden', className)}>
      {isLoading ? (
        <div className="p-6 flex justify-center">
          <Loading />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p className="text-sm">No jobs</p>
          <button
            onClick={() => onRefresh()}
            className="mt-2 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={classNames('text-xs uppercase text-gray-500 bg-gray-800/50 border-b border-gray-800', theadClassName)}>
              <tr>
                {columns.map(column => (
                  <th key={column.key} className="px-4 py-2.5 font-medium">
                    {column.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, index) => {
                return (
                  <tr
                    key={index}
                    className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors last:border-0"
                  >
                    {columns.map(column => (
                      <td key={column.key} className={classNames('px-4 py-2.5 text-gray-300', column.className)}>
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
