import Loading from '../feedback/Loading';
import styles from './Button.module.scss';

type ButtonHtmlProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

type ButtonProps =
    | (ButtonHtmlProps & {
          type: 'inline' | 'block' | 'flex';
          variant?: undefined;
          working?: undefined;
      })
    | (ButtonHtmlProps & {
          type: 'button';
          variant?: 'accent' | 'border';
          working?: boolean | undefined;
      });

export default function Button(props: ButtonProps) {

    const { children, className, type = 'button', working = false, variant, ...rest } = props;

    const classList = [styles[type], className];
    if (variant) {
        classList.push(styles[variant]);
    }
    if (working) {
        classList.push(styles.working);
    }
    const classNames = classList.filter(Boolean).join(' ');

    return (
        <button className={classNames} {...rest} type="button">
            {children}
            { working && <Loading size="small" color="reverse" className={styles.loading} /> }
        </button>
    );
}