import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { FaChevronDown } from 'react-icons/fa';
import classNames from 'classnames';

interface CardProps {
  title?: string;
  children?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const Card: React.FC<CardProps> = ({ title, children, collapsible, defaultOpen }) => {
  if (collapsible) {
    return (
      <Disclosure as="section" className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" defaultOpen={defaultOpen}>
        {({ open }) => (
          <>
            <DisclosureButton className="w-full text-left flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
              <div className="flex-1">
                {title && (
                  <h2 className={classNames('text-sm font-semibold uppercase tracking-wider text-gray-400', { 'text-gray-500': open })}>
                    {title}
                  </h2>
                )}
              </div>
              <FaChevronDown className={`ml-2 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
            </DisclosureButton>
            <DisclosurePanel className="px-5 pb-5">
              {children ?? null}
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
    );
  }
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {title && (
        <div className="px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
        </div>
      )}
      <div className="px-5 pb-5">
        {children ?? null}
      </div>
    </section>
  );
};

export default Card;
