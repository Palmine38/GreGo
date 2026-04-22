function NoMobile() {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100vw',
        }}>
            <img
                src="/nomobile.png"
                alt="Mobile uniquement"
                style={{ maxWidth: '400px', width: '80%' }}
            />
        </div>
    )
}

export default NoMobile